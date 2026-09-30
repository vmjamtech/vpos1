import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { firstValueFrom } from 'rxjs';
import { SqliteService } from './sqlite.service';
import moment from 'moment';
import { apiBaseUrl } from './api-url';

@Injectable({
  providedIn: 'root',
})
export class PersonnelTransactionService {
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private db: SqliteService
  ) {}

  private async getBaseUrl(): Promise<string> {
    const connection = await this.storageService.get<{
      ip: string;
      port: string;
    }>('connection');
    if (!connection?.ip || !connection?.port) {
      throw new Error('No connection settings found.');
    }
    return `${apiBaseUrl(connection.ip, connection.port)}/deltransact`;
  }

  async getAll(): Promise<any[]> {
    const url = (await this.getBaseUrl()) + '/all';
    return await firstValueFrom(this.http.get<any[]>(url));
  }

  async getTransactions(
    limit: number = 30,
    offset: number = 0
  ): Promise<any[]> {
    const url =
      (await this.getBaseUrl()) +
      `/filter/offset?limit=${limit}&offset=${offset}`;
    return await firstValueFrom(this.http.get<any[]>(url));
  }

  async getById(dtid: number): Promise<any> {
    const url = (await this.getBaseUrl()) + `/${dtid}`;
    return await firstValueFrom(this.http.get<any>(url));
  }

  async getByRefNum(dtrefnum: string): Promise<any> {
    const url = (await this.getBaseUrl()) + `/ref/${dtrefnum}`;
    return await firstValueFrom(this.http.get<any>(url));
  }

  async create(transaction: any): Promise<any> {
    const url = await this.getBaseUrl();
    return await firstValueFrom(this.http.post<any>(url, transaction));
  }

  async update(dtid: number, transaction: any): Promise<any> {
    const url = (await this.getBaseUrl()) + `/update/${dtid}`;
    return await firstValueFrom(this.http.post<any>(url, transaction));
  }

  async insertTransaction(params: any): Promise<any> {
    const url = (await this.getBaseUrl()) + '/transaction';
    return await firstValueFrom(this.http.post<any>(url, params));
  }

  async insertTransactiondb(params: any): Promise<void> {
    const {
      cart,
      refnum,
      custName,
      custId,
      cashier,
      customerCat,
      delCount,
      delby1,
      delby2,
      paymentType,
    } = params;

    const status = paymentType;
    const col = customerCat === '1-PICK UP' ? 'compickup' : 'comdel';

    for (const item of cart) {
      // 1. Get commission rate for item
      const commQuery = `SELECT ${col} FROM commtbl WHERE comitemid = ? LIMIT 1`;
      const commRes = await this.db.query(commQuery, [item.itemid]);
      const saldec = commRes.length > 0 ? commRes[0][col] || 0 : 0;

      // 2. Calculate salary
      const qty = item.qty || 0;
      const salary = delCount === 2 ? (saldec * qty) / 2 : saldec * qty;

      // 3. Insert into deltransacttbl
      const insertQuery = `
        INSERT INTO deltransacttbl (
          dtrefnum, dtcustname, dtcustid, delcashier, dtdate,
          dsalary, deltype, dtdelby, dtdelbyid, dtdelby2, dtdelbyid2,
          dtstatus, delitemcode, delitemqty, delcomm, delitemsize
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;

      const insertParams = [
        refnum,
        custName,
        custId || null,
        cashier,
        moment().format('YYYY-MM-DD HH:mm:ss'),
        salary,
        customerCat,
        delby1.name,
        delby1.id,
        delby2?.name || null,
        delby2?.id || null,
        status,
        item.itemcode,
        qty,
        saldec,
        item.size || null,
      ];

      await this.db.execute(insertQuery, insertParams);

      // 4. Update personnel salary (delby1)
      const update1 = `
        UPDATE personeltbl
        SET ptotalpay = ptotalpay + ?, ptrans = ptrans + 1
        WHERE pid = ?
      `;

      await this.db.execute(update1, [salary, delby1.id]);

      // 5. If two personnel, update the second
      if (delCount === 2 && delby2) {
        const update2 = `
          UPDATE personeltbl
          SET ptotalpay = ptotalpay + ?, ptrans = ptrans + 1
          WHERE pid = ?
        `;
        await this.db.execute(update2, [salary, delby2.id]);
      }
    }
  }

  async getCashierTransactionByIdAndDate(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    limit: number = 20,
    offset: number = 0,
    loadingAll: boolean = false
  ): Promise<any[]> {
    let sql = `
    SELECT 
      t1.scid,
      t2.salesdate,
      t2.salesrefnum,
      t2.salescust,
      'Sales' AS salescat,
      t3.itemsize,
      (CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) / NULLIF(s.saldiv, 0)) * t1.scqty AS salary,
      t2.salestatus,
      t1.scqty
    FROM salescart t1
    INNER JOIN salestbl t2 ON t1.screfnum = t2.salesrefnum
    INNER JOIN inventorytbl t3 ON t1.scitemcode = t3.itemcode
    INNER JOIN salsettings s ON s.salpid = ?
    WHERE t2.salescashier = ?
  `;

    const params: any[] = [pid, pname];

    if (!loadingAll) {
      sql += ` AND t2.salesdate >= ? AND t2.salesdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
    UNION ALL
    SELECT 
      dtid AS scid,
      dtdate AS salesdate,
      dtrefnum AS salesrefnum,
      dtcustname AS salescust,
      SUBSTR(t0.deltype, 3) AS salescat,
      t1.itemsize,
      dsalary AS salary,
      dtstatus AS salestatus,
      delitemqty AS scqty
    FROM deltransacttbl t0
    INNER JOIN inventorytbl t1 ON t1.itemcode = t0.delitemcode
    WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
  `;

    params.push(pid, pid);

    if (!loadingAll) {
      sql += ` AND dtdate >= ? AND dtdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
    ORDER BY salesdate DESC
    LIMIT ? OFFSET ?
  `;

    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching cashier transactions:', error);
      throw new Error('Failed to load transactions.');
    }
  }

  async getRiderTransactionByIdAndDate(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    limit: number = 20,
    offset: number = 0,
    loadingAll: boolean = false
  ): Promise<any[]> {
    let sql = `SELECT dtid as scid, dtdate as salesdate, dtrefnum as salesrefnum, dtcustname as salescust, SUBSTR(deltype, 3) as salescat, 
              t1.itemsize, dsalary as salary, dtstatus as salestatus, delitemqty as scqty 
              FROM deltransacttbl t0    
              INNER JOIN inventorytbl t1 ON t1.itemcode = t0.delitemcode  
              WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
  `;

    const params: any[] = [pid, pid];

    if (!loadingAll) {
      sql += ` AND dtdate >= ? AND dtdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
    ORDER BY dtdate DESC
    LIMIT ? OFFSET ?
  `;

    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching rider transactions:', error);
      throw new Error('Failed to load transactions.');
    }
  }

  async getDriverTransactionByIdAndDate(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    limit: number = 20,
    offset: number = 0,
    loadingAll: boolean = false
  ): Promise<any[]> {
    let sql = `SELECT t1.pid as scid, t2.pulldate as salesdate, t2.poutrefnum as salesrefnum, t2.pullsupplier as salescust, 
                       t3.itemsize, t2.pulloutremarks as salestatus, t1.poutqty as scqty, t2.pouttype as salescat, 
                       CASE WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 11 THEN s.sal11kg * t1.poutqty
                       WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 2.7 THEN s.sal2kg * t1.poutqty
                       WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 5 THEN s.sal5kg * t1.poutqty 
                       WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 22 THEN s.sal22kg * t1.poutqty 
                       WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 50 THEN s.sal50kg * t1.poutqty
                       ELSE 0 END AS salary
                       FROM pulloutcart t1
                       INNER JOIN pouttbl t2 ON t1.poutref = t2.poutrefnum
                       INNER JOIN inventorytbl t3 ON t1.poutitemcode = t3.itemcode
                       INNER JOIN salsettings s ON s.salpid = t2.poutpid 
                       WHERE t2.pouttype in ('RESTOCK IN', 'RESTOCK OUT') and t1.pouttype in ('RESTOCK INFILL', 'RESTOCK OUTEMPTY') 
                       AND t2.poutpid = ? AND t2.pulloutremarks <> 'Waiting'`;

    const params: any[] = [pid];

    if (!loadingAll) {
      sql += ` AND pulldate >= ? AND pulldate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `UNION ALL
    SELECT t0.dtid AS scid, t0.dtdate AS salesdate, t0.dtrefnum AS salesrefnum, t0.dtcustname AS salescust, 
    t1.itemsize, t0.dtstatus AS salestatus, t0.delitemqty AS scqty, SUBSTR(t0.deltype, 3) AS salescat, 
    t0.dsalary AS salary FROM deltransacttbl t0 INNER JOIN inventorytbl t1 ON t1.itemcode = t0.delitemcode 
    WHERE (t0.dtdelbyid = ? OR t0.dtdelbyid2 = ?)
  `;

    params.push(pid, pid);

    if (!loadingAll) {
      sql += ` AND dtdate >= ? AND dtdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
    ORDER BY pulldate DESC
    LIMIT ? OFFSET ?
  `;

    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching driver transactions:', error);
      throw new Error('Failed to load transactions.');
    }
  }

  async getCashierSumSalary(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    loadingAll: boolean = false
  ): Promise<number> {
    let sql = `
    SELECT SUM(salary) AS totalsalary FROM (
      
      -- SALES PART
      SELECT 
        (CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) / NULLIF(s.saldiv, 0)) * t1.scqty AS salary
      FROM salescart t1
      INNER JOIN salestbl t2 ON t1.screfnum = t2.salesrefnum
      INNER JOIN inventorytbl t3 ON t1.scitemcode = t3.itemcode
      INNER JOIN salsettings s ON s.salpid = ?
      WHERE t2.salescashier = ?
  `;

    const params: any[] = [pid, pname];

    if (!loadingAll) {
      sql += ` AND t2.salesdate >= ? AND t2.salesdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
      UNION ALL
      
      -- DELIVERY PART
      SELECT 
        dsalary AS salary
      FROM deltransacttbl t0
      INNER JOIN inventorytbl t1 ON t1.itemcode = t0.delitemcode
      WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
  `;

    params.push(pid, pid);

    if (!loadingAll) {
      sql += ` AND dtdate >= ? AND dtdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
    ) AS combined;
  `;

    try {
      const result = await this.db.query(sql, params);
      return result[0]?.totalsalary ?? 0;
    } catch (error) {
      console.error('Error fetching summed salary:', error);
      throw new Error('Failed to load income total.');
    }
  }

  async getRiderSumSalary(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    loadingAll: boolean = false
  ): Promise<number> {
    let sql = `
    SELECT SUM(dsalary) AS totalsalary  
              FROM deltransacttbl t0    
              INNER JOIN inventorytbl t1 ON t1.itemcode = t0.delitemcode  
              WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
  `;

    const params: any[] = [pid, pid];

    if (!loadingAll) {
      sql += ` AND dtdate >= ? AND dtdate <= ? `;
      params.push(datefrom, dateto);
    }

    try {
      const result = await this.db.query(sql, params);
      return result[0]?.totalsalary ?? 0;
    } catch (error) {
      console.error('Error fetching rider salary:', error);
      throw new Error('Failed to load income total.');
    }
  }

  async getDriverSumSalary(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    loadingAll: boolean = false
  ): Promise<number> {
    let sql = `
    SELECT SUM(salary) AS totalsalary FROM (
      
      -- SALES PART
    SELECT CASE WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 11 THEN s.sal11kg * t1.poutqty
            WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 2.7 THEN s.sal2kg * t1.poutqty
            WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 5 THEN s.sal5kg * t1.poutqty 
            WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 22 THEN s.sal22kg * t1.poutqty 
            WHEN CAST(REPLACE(t3.itemsize, 'kg', '') AS REAL) = 50 THEN s.sal50kg * t1.poutqty
            ELSE 0 END AS salary
            FROM pulloutcart t1
            INNER JOIN pouttbl t2 ON t1.poutref = t2.poutrefnum
            INNER JOIN inventorytbl t3 ON t1.poutitemcode = t3.itemcode
            INNER JOIN salsettings s ON s.salpid = t2.poutpid 
            WHERE t2.pouttype in ('RESTOCK IN', 'RESTOCK OUT') and t1.pouttype in ('RESTOCK INFILL', 'RESTOCK OUTEMPTY') 
            AND t2.poutpid = ? AND t2.pulloutremarks <> 'Waiting'
  `;

    const params: any[] = [pid];

    if (!loadingAll) {
      sql += ` AND pulldate >= ? AND pulldate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
      UNION ALL
      
      -- DELIVERY PART 
    SELECT t0.dsalary AS salary FROM deltransacttbl t0 INNER JOIN inventorytbl t1 ON t1.itemcode = t0.delitemcode 
    WHERE (t0.dtdelbyid = ? OR t0.dtdelbyid2 = ?)
  `;

    params.push(pid, pid);

    if (!loadingAll) {
      sql += ` AND dtdate >= ? AND dtdate <= ? `;
      params.push(datefrom, dateto);
    }

    sql += `
    ) AS combined;
  `;

    try {
      const result = await this.db.query(sql, params);
      return result[0]?.totalsalary ?? 0;
    } catch (error) {
      console.error('Error fetching driver salary:', error);
      throw new Error('Failed to load income total.');
    }
  }

  async getSalaryDays(
    role: string,
    pname: string,
    pid: number,
    datefrom: string,
    dateto: string,
    loadingAll: boolean = false
  ): Promise<number> {
    let sql = '';
    const params: any[] = [];

    const dateFilter = loadingAll
      ? ''
      : ' AND datefield >= ? AND datefield <= ?';

    if (!loadingAll) {
      params.push(datefrom, dateto);
    }

    // DRIVER
    if (role === 'Driver') {
      sql = `
      SELECT COUNT(DISTINCT sales_date) AS total_days FROM (
        SELECT DATE(pulldate) AS sales_date 
        FROM pouttbl 
        WHERE poutpid = ? AND pulldate IS NOT NULL 
        ${loadingAll ? '' : 'AND pulldate >= ? AND pulldate <= ?'}

        UNION

        SELECT DATE(dtdate) AS sales_date 
        FROM deltransacttbl 
        WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
        ${loadingAll ? '' : 'AND dtdate >= ? AND dtdate <= ?'}
      )
    `;

      params.unshift(pid); // first param
      if (!loadingAll) params.push(pid, pid); // for delivery filter
    }
    // RIDER
    else if (role === 'Rider') {
      sql = `
      SELECT COUNT(DISTINCT DATE(dtdate)) AS total_days
      FROM deltransacttbl
      WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
      ${loadingAll ? '' : 'AND dtdate >= ? AND dtdate <= ?'}
    `;
      params.unshift(pid, pid);
    }
    // CASHIER / STOREKEEPER
    else {
      sql = `
      SELECT COUNT(DISTINCT sales_date) AS total_days FROM (
        SELECT DATE(salesdate) AS sales_date 
        FROM salestbl 
        WHERE salescashier = ? 
        ${loadingAll ? '' : 'AND salesdate >= ? AND salesdate <= ?'}

        UNION

        SELECT DATE(dtdate) AS sales_date 
        FROM deltransacttbl 
        WHERE (dtdelbyid = ? OR dtdelbyid2 = ?)
        ${loadingAll ? '' : 'AND dtdate >= ? AND dtdate <= ?'}
      )
    `;
      params.unshift(pname);
      if (!loadingAll) params.push(pid, pid);
    }

    const result = await this.db.query(sql, params);
    return result[0]?.total_days ?? 0;
  }

  async getDailyRate(pid: number): Promise<number> {
    const sql = `SELECT IFNULL(saldaily,0) AS saldaily FROM salsettings WHERE salpid = ?`;
    const result = await this.db.query(sql, [pid]);
    return result[0]?.saldaily ?? 0;
  }

  async computeTotalSalary(
    role: string,
    pname: string,
    pid: number,
    dateFrom: string,
    dateTo: string,
    loadingAll: boolean = false
  ): Promise<number> {
    try {
      const daily = await this.getDailyRate(pid);
      const totalDays = await this.getSalaryDays(
        role,
        pname,
        pid,
        dateFrom,
        dateTo,
        loadingAll
      );

      return Number(daily) * Number(totalDays);
    } catch (err) {
      console.error('Error computing salary:', err);
      return 0;
    }
  }

  /** Generate reference number like VB.NET autogennum() */
  async autogennum(): Promise<string> {
    const today = moment().format('YYYY-MM-DD');
    const countResult: any = await this.db.query(
      'SELECT COUNT(*) AS valuez FROM salhistory WHERE DATE(saldate) = ?',
      [today]
    );
    const autoId = (countResult[0]?.valuez ?? 0) + 1;
    const dateStr = moment().format('MMDDYY');
    const padded = autoId.toString().padStart(6, '0');
    return `${padded}-${dateStr}`;
  }

  /** Insert salary history for a personnel over a date range */
  async insertPaySalaryHistory(data: {
    pname: string;
    pid: number;
    tendered: number;
    totalPay: number;
    dailyRate: number;
    additional: number;
    lessPay: number;
    incentive: number;
    remarks: string;
    paidBy: string;
    dateFrom: string;
    dateTo: string;
    paymentMethod: string;
  }): Promise<void> {
    const refnum = await this.autogennum();
    const startDate = moment(data.dateFrom);
    const endDate = moment(data.dateTo);
    const salRefDate = moment().format('YYYY-MM-DD HH:mm:ss');

    let current = startDate.clone();
    while (current.isSameOrBefore(endDate, 'day')) {
      const day = current.format('YYYY-MM-DD');
      const sql = `
        INSERT INTO salhistory
        (salpersonel, salpersonelid, salpaid, saldate, salpaidby, saltotal, saldailypay, saladdpay, sallesspay, salincentive, salremarks, salrefnum, salrefdate, salpaymethod)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await this.db.query(sql, [
        data.pname,
        data.pid,
        data.tendered,
        day,
        data.paidBy,
        data.totalPay,
        data.dailyRate,
        data.additional,
        data.lessPay,
        data.incentive,
        data.remarks,
        refnum,
        salRefDate,
        data.paymentMethod,
      ]);

      current.add(1, 'day');
    }

    // Update personnel total pay
    const updateSql = `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`;
    await this.db.query(updateSql, [data.totalPay - data.tendered, data.pid]);
  }

  async getSalaryHistory(
    datefrom: string,
    dateto: string,
    pname: string,
    pid: number,
    limit: number = 20,
    offset: number = 0,
    loadingAll: boolean = false
  ): Promise<any[]> {
    let sql = `
    SELECT sh.*
    FROM salhistory sh
    INNER JOIN (
      SELECT salremarks, MAX(saldate) AS lastSalDate
      FROM salhistory
      WHERE salpersonelid = ?
      ${
        !loadingAll && datefrom && dateto
          ? 'AND DATE(salrefdate) >= ? AND DATE(salrefdate) <= ?'
          : ''
      }
      GROUP BY salremarks
    ) grouped ON sh.salremarks = grouped.salremarks AND sh.saldate = grouped.lastSalDate
    ORDER BY sh.salrefdate DESC
    LIMIT ? OFFSET ?
  `;

    const params: any[] = [pid];
    if (!loadingAll && datefrom && dateto) {
      params.push(datefrom, dateto);
    }
    params.push(limit, offset);

    try {
      return await this.db.query(sql, params);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      throw new Error('Failed to load salary history.');
    }
  }

  async getSalarySumHistoryTotal(
    datefrom: string,
    dateto: string,
    pid: number,
    loadingAll: boolean = false
  ): Promise<number> {
    let sql = `
    SELECT SUM(salpaid) AS total
    FROM (
      SELECT salremarks, salpaid
      FROM salhistory
      WHERE salpersonelid = ?
      ${!loadingAll ? 'AND salrefdate >= ? AND salrefdate <= ?' : ''}
      GROUP BY salremarks
    ) AS grouped
  `;

    const params: any[] = [pid];
    if (!loadingAll) {
      params.push(datefrom, dateto);
    }

    try {
      const result = await this.db.query(sql, params);
      return result[0]?.total ?? 0;
    } catch (error) {
      console.error('Error fetching salary history total:', error);
      throw new Error('Failed to load salary history total.');
    }
  }

  async updatePersonnelSalary(
    refnum: string,
    delById: number | null,
    delBy2Id: number | null
  ): Promise<void> {
    // Step 1: Get total salary for this reference number
    const salaryResult: any = await this.db.query(
      `SELECT SUM(dsalary) AS salary FROM deltransacttbl WHERE dtrefnum = ?`,
      [refnum]
    );

    let totalSalary = 0;
    if (salaryResult.length > 0 && salaryResult[0].salary != null) {
      totalSalary = parseFloat(salaryResult[0].salary);
    }

    // Step 2: Mark transactions as CANCELLED
    await this.db.query(
      `UPDATE deltransacttbl SET dtstatus = 'CANCELLED' WHERE dtrefnum = ?`,
      [refnum]
    );

    // Step 3: Update personnel salaries
    if (delById != null) {
      const ptotalpay = delBy2Id != null ? totalSalary / 2 : totalSalary;
      await this.db.query(
        `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`,
        [ptotalpay, delById]
      );

      console.log(
        `Salary updated for personnel ID ${delById}, amount: ${ptotalpay}`
      );
    }

    if (delBy2Id != null) {
      const ptotalpay2 = totalSalary / 2;
      await this.db.query(
        `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`,
        [ptotalpay2, delBy2Id]
      );

      console.log(
        `Salary updated for personnel ID ${delBy2Id}, amount: ${ptotalpay2}`
      );
    }
  }

  async cancelDeliverySalaryUpdate(
    qty: number,
    itemcode: string,
    refnum: string,
    delbyId1?: number,
    delbyId2?: number
  ): Promise<void> {
    // 1. Get commission per item
    const result: any = await this.db.query(
      `SELECT delcomm FROM deltransacttbl WHERE dtrefnum = ? AND delitemcode = ?`,
      [refnum, itemcode]
    );

    if (!result || result.length === 0) {
      console.warn('No commission found for this item');
      return;
    }

    const comms = Number(result[0].delcomm);
    const sal = comms * qty;

    // 2. Deduct salaries
    if (delbyId1 && delbyId2) {
      // Split salary between two personnel
      const halfSal = sal / 2;

      await this.db.execute(
        `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`,
        [halfSal, delbyId1]
      );

      await this.db.execute(
        `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`,
        [halfSal, delbyId2]
      );

      console.log(
        `Salary updated for ${delbyId1} and ${delbyId2}, REFNUM: ${refnum}`
      );
    } else if (delbyId2) {
      await this.db.execute(
        `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`,
        [sal, delbyId2]
      );
      console.log(`Salary updated for ${delbyId2}, REFNUM: ${refnum}`);
    } else if (delbyId1) {
      await this.db.execute(
        `UPDATE personeltbl SET ptotalpay = ptotalpay - ? WHERE pid = ?`,
        [sal, delbyId1]
      );
      console.log(`Salary updated for ${delbyId1}, REFNUM: ${refnum}`);
    }

    // 3. Update delivery transaction qty and salary
    await this.db.execute(
      `UPDATE deltransacttbl 
       SET delitemqty = delitemqty - ?, 
           dsalary = ? 
     WHERE dtrefnum = ? AND delitemcode = ?`,
      [qty, comms * qty, refnum, itemcode]
    );

    // 4. Mark CANCELLED if quantity < 1
    await this.db.execute(
      `UPDATE deltransacttbl 
       SET dtstatus = 'CANCELLED' 
     WHERE dtrefnum = ? AND delitemcode = ? AND delitemqty < 1`,
      [refnum, itemcode]
    );
  }
}
