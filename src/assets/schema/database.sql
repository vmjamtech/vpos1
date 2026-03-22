CREATE TABLE IF NOT EXISTS USERS (
          userid TEXT PRIMARY KEY COLLATE NOCASE,
          name TEXT NOT NULL COLLATE NOCASE,
          password TEXT DEFAULT '' COLLATE NOCASE,
          prvlevel INTEGER DEFAULT 0,
          cashier INTEGER DEFAULT 0,
          jobclass TEXT DEFAULT '' COLLATE NOCASE, 
          usrpriv TEXT default '' COLLATE NOCASE,
          us_lastupd TEXT default '' COLLATE NOCASE, 
          us_resign TEXT default '' COLLATE NOCASE,
          us_start TEXT default '' COLLATE NOCASE,
          us_stid TEXT default '' COLLATE NOCASE,
          us_active TEXT default 'N' COLLATE NOCASE
          );

CREATE TABLE IF NOT EXISTS TINVMAIN (
          im_invtype TEXT NOT NULL COLLATE NOCASE,
          im_invno INTEGER NOT NULL,
          im_branch TEXT DEFAULT '' COLLATE NOCASE,
          im_key TEXT DEFAULT '' COLLATE NOCASE,
          im_trndate TEXT default '' COLLATE NOCASE,
          im_itrndate TEXT default '' COLLATE NOCASE,
          im_srcdest TEXT DEFAULT '' COLLATE NOCASE,
          im_refno TEXT DEFAULT '' COLLATE NOCASE,
          im_refno2 INTEGER NOT NULL default 0,
          im_remarks TEXT default '' COLLATE NOCASE,
          im_whse TEXT DEFAULT '' COLLATE NOCASE,
          im_ptuserid TEXT default '' COLLATE NOCASE,
          im_postdate TEXT default '' COLLATE NOCASE,
          im_candate TEXT default '' COLLATE NOCASE,
          im_closedate TEXT default '' COLLATE NOCASE,
          im_uploaded TEXT default '' COLLATE NOCASE,
          im_trntime TEXT default '' COLLATE NOCASE,
          im_crdate TEXT default '' COLLATE NOCASE,
          im_cruserid TEXT default '' COLLATE NOCASE,    
          im_lastupd TEXT default '' COLLATE NOCASE,
          im_mouserid TEXT default '' COLLATE NOCASE,
          im_drno TEXT default '' COLLATE NOCASE,
          im_doctype TEXT default '' COLLATE NOCASE,
          im_status TEXT default '' COLLATE NOCASE,
          im_subtype TEXT default '' COLLATE NOCASE,
          im_error TEXT default '' COLLATE NOCASE,
          im_staff TEXT default '' COLLATE NOCASE,
          im_duedate TEXT default '' COLLATE NOCASE,
          PRIMARY KEY (im_invtype, im_invno, im_branch, im_key)
        );
             
CREATE TABLE IF NOT EXISTS TINVSUB (
          is_branch TEXT DEFAULT '' COLLATE NOCASE,
          is_invtype TEXT COLLATE NOCASE,
          is_iminvno INTEGER NOT NULL,
          is_key TEXT DEFAULT '' COLLATE NOCASE,
          is_rownum INTEGER DEFAULT 0,
          is_desc TEXT default '' COLLATE NOCASE,
          is_itemid TEXT DEFAULT '' COLLATE NOCASE,
          is_barcode TEXT DEFAULT '' COLLATE NOCASE,
          is_unit TEXT default '' COLLATE NOCASE,
          is_qty REAL DEFAULT 0,
          is_cost REAL DEFAULT 0,
          is_orgcost REAL DEFAULT 0,
          is_whse TEXT default '' COLLATE NOCASE,
          is_invqty REAL DEFAULT 0,
          is_ordqty REAL DEFAULT 0,
          is_pkgqty INTEGER DEFAULT 0,
          is_base INTEGER DEFAULT 0,
          is_baserow INTEGER DEFAULT 0,
          is_disc REAL DEFAULT 0,
          is_message TEXT default '' COLLATE NOCASE,
          is_price REAL DEFAULT 0,
          is_prqty REAL DEFAULT 0,
          is_prunit TEXT DEFAULT '' COLLATE NOCASE,
          is_prpkgqty REAL DEFAULT 0,
          is_prinvqty REAL DEFAULT 0,
          is_netprc REAL DEFAULT 0,
          is_netuprc REAL DEFAULT 0,
          is_trntime TEXT default '' COLLATE NOCASE,
          is_orgprice REAL DEFAULT 0,
          is_skr TEXT DEFAULT '' COLLATE NOCASE,
          is_rebamt REAL DEFAULT 0,
          PRIMARY KEY (is_invtype, is_iminvno, is_branch, is_key, is_rownum,is_itemid)
          );

CREATE TABLE IF NOT EXISTS TSERIAL (
            ts_invtype TEXT COLLATE NOCASE,
            ts_iminvno INTEGER NOT NULL,
            ts_branch TEXT COLLATE NOCASE,
            ts_key TEXT DEFAULT '' COLLATE NOCASE,
            ts_baseline INTEGER DEFAULT 0,
            ts_rownum INTEGER DEFAULT 0,
            ts_itemid TEXT DEFAULT '' COLLATE NOCASE,
            ts_serial TEXT DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (ts_invtype, ts_iminvno, ts_branch, ts_key, ts_baseline, ts_rownum)
          );

CREATE TABLE IF NOT EXISTS TBATCH (
            tb_invtype TEXT COLLATE NOCASE,
            tb_iminvno INTEGER NOT NULL,
            tb_branch TEXT COLLATE NOCASE,
            tb_key TEXT DEFAULT '' COLLATE NOCASE,
            tb_baseline INTEGER DEFAULT 0,
            tb_rownum INTEGER DEFAULT 0,
            tb_itemid TEXT DEFAULT '' COLLATE NOCASE,
            tb_unit TEXT DEFAULT '' COLLATE NOCASE,
            tb_pkgqty INTEGER DEFAULT 0,
            tb_batch TEXT DEFAULT '' COLLATE NOCASE,
            tb_qty INTEGER DEFAULT 0,
            tb_expiry TEXT DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (tb_invtype, tb_iminvno, tb_branch, tb_key, tb_baseline, tb_rownum)
          );
              
CREATE TABLE IF NOT EXISTS STORES (
            st_code TEXT NOT NULL COLLATE NOCASE,
            st_name TEXT NOT NULL default '' COLLATE NOCASE,
            st_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (st_code)
          );
          
CREATE TABLE IF NOT EXISTS USERLOC (
            ul_code TEXT NOT NULL COLLATE NOCASE,
            ul_userid TEXT NOT NULL COLLATE NOCASE,
            ul_stcode TEXT NOT NULL COLLATE NOCASE,
            U_WHOUSE TEXT NOT NULL COLLATE NOCASE,
            ul_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (ul_code)
          );
          
CREATE TABLE IF NOT EXISTS PRODUCTS (
            itemid TEXT NOT NULL COLLATE NOCASE,
            barcode TEXT NOT NULL default '' COLLATE NOCASE,
            description TEXT NOT NULL default '' COLLATE NOCASE,
            uom TEXT NOT NULL default '' COLLATE NOCASE,
            itemgroup INTEGER DEFAULT 0,
            price INTEGER DEFAULT 0,
            pkgqty INTEGER DEFAULT 0,
            active INTEGER DEFAULT 0,
            batched INTEGER DEFAULT 0,
            serialized INTEGER DEFAULT 0,
            crdate TEXT NOT NULL default '' COLLATE NOCASE,
            lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            rate REAL DEFAULT 0,
            isgrossprc TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (itemid, barcode, uom)
          );

CREATE TABLE IF NOT EXISTS TIMELINE (
            eventdate TEXT NOT NULL COLLATE NOCASE,
            remarks TEXT NOT NULL default '' COLLATE NOCASE,
            user TEXT NOT NULL default '' COLLATE NOCASE,
            branch TEXT NOT NULL default '' COLLATE NOCASE,
            key TEXT NO NULL default '' COLLATE NOCASE,
            PRIMARY KEY (eventdate)
          );
          
CREATE TABLE IF NOT EXISTS TACTIVITY (
            ac_id INTEGER NOT NULL,
            ac_scid INTEGER NOT NULL,
            ac_sapid INTEGER,
            ac_technician TEXT NOT NULL default '' COLLATE NOCASE,
            ac_starttime TEXT NOT NULL default '' COLLATE NOCASE,
            ac_endtime TEXT NOT NULL default '' COLLATE NOCASE,
            ac_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            ac_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            ac_remarks TEXT NOT NULL default '' COLLATE NOCASE,
            ac_postdate TEXT NOT NULL default '' COLLATE NOCASE,
            ac_uploaded TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (ac_id, ac_scid, ac_sapid)
          );
          
CREATE TABLE IF NOT EXISTS TSERVCALL (
            sc_docnum INTEGER NOT NULL,
            sc_id INTEGER NOT NULL,
            sc_status TEXT NOT NULL default '' COLLATE NOCASE,
            sc_origin TEXT NOT NULL default '' COLLATE NOCASE,
            sc_calltype TEXT NOT NULL default '' COLLATE NOCASE,
            sc_probtype TEXT NOT NULL default '' COLLATE NOCASE,
            sc_subtype TEXT NOT NULL default '' COLLATE NOCASE,
            sc_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            sc_closedate TEXT NOT NULL default '' COLLATE NOCASE,
            sc_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            sc_serial TEXT NOT NULL default '' COLLATE NOCASE,
            sc_itemid TEXT NOT NULL default '' COLLATE NOCASE,
            sc_card TEXT NOT NULL default '' COLLATE NOCASE,
            sc_customer TEXT NOT NULL default '' COLLATE NOCASE,
            sc_technician TEXT NOT NULL default '' COLLATE NOCASE,
            sc_assignee TEXT NOT NULL default '' COLLATE NOCASE,
            sc_subject TEXT NOT NULL default '' COLLATE NOCASE,
            sc_remarks TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (sc_docnum, sc_id)
          );
          
CREATE TABLE IF NOT EXISTS MSERVCALLTYPE(
            ct_id NUMBER NOT NULL,
            ct_name TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            ct_desc TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (ct_id)
          );
          
CREATE TABLE IF NOT EXISTS MSERVORGN(
            so_id NUMBER NOT NULL,
            so_name TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            so_desc TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            so_locked TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (so_id)
          );
          
CREATE TABLE IF NOT EXISTS MSERVPROBTYPE(
            sp_id NUMBER NOT NULL,
            sp_name TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            sp_desc TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (sp_id)
          );
          
CREATE TABLE IF NOT EXISTS MSERVSUBTYPE(
            st_id NUMBER NOT NULL,
            st_name TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            st_desc TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (st_id)
          );
          
CREATE TABLE IF NOT EXISTS MCUSTOMR (
            cs_code TEXT NOT NULL COLLATE NOCASE,
            cs_name TEXT NOT NULL default '' COLLATE NOCASE,
            cs_plist NUMBER NOT NULL default 0,
            cs_balance NUMBER NOT NULL default 0,
            cs_sales TEXT NOT NULL default '' COLLATE NOCASE,
            cs_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (cs_code)
          );
          
CREATE TABLE IF NOT EXISTS ITEMWHSE (
            iw_itemid TEXT NOT NULL COLLATE NOCASE,
            iw_branch TEXT NOT NULL COLLATE NOCASE,
            iw_onhand INTEGER NOT NULL default 0,
            iw_commited INTEGER NOT NULL default 0,
            iw_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            iw_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (iw_itemid, iw_branch)
          );
          
CREATE TABLE IF NOT EXISTS MEQUIPMENT (
            eq_id INTEGER NOT NULL,
            eq_mnfnum TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_serial TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_warranty TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_start TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_end TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_itemid TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_customer TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_crdate TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            eq_lastupd TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
            PRIMARY KEY (eq_id)
          );
          
CREATE TABLE IF NOT EXISTS MSERIAL (
            sn_itemid TEXT NOT NULL COLLATE NOCASE,
            sn_serial TEXT NOT NULL COLLATE NOCASE,
            sn_enddate TEXT NOT NULL default '' COLLATE NOCASE,
            sn_startdate TEXT NOT NULL default '' COLLATE NOCASE,
            sn_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            sn_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (sn_itemid, sn_serial)
          );
          
CREATE TABLE IF NOT EXISTS MPRICE (
            pp_branch  TEXT NOT NULL COLLATE NOCASE,
            pp_prodid  TEXT NOT NULL COLLATE NOCASE,
            pp_unit TEXT NOT NULL default '' COLLATE NOCASE,
            pp_price INTEGER NOT NULL default 0,
            pp_crdate  TEXT NOT NULL default '' COLLATE NOCASE,
            pp_lastupd  TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (pp_branch, pp_prodid, pp_unit)
          );
          
CREATE TABLE IF NOT EXISTS PRICELIST (
            pl_itemid  TEXT NOT NULL COLLATE NOCASE,
            pl_price  INTEGER NOT NULL default 0,
            pl_plist INTEGER NOT NULL default 0,
            pl_unit TEXT NOT NULL default '' COLLATE NOCASE,
            pl_crdate  TEXT NOT NULL default '' COLLATE NOCASE,
            pl_lastupd  TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (pl_itemid, pl_price, pl_plist,pl_unit)
          );
          
CREATE TABLE IF NOT EXISTS ITEMGROUPS (
            ig_code  INTEGER NOT NULL default 0,
            ig_name  TEXT NOT NULL default '' COLLATE NOCASE,
            ig_crdate  TEXT NOT NULL default '' COLLATE NOCASE,
            ig_lastupd  TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (ig_code)
          );
          
CREATE TABLE IF NOT EXISTS SPECIALPRICE (
            sp_id INTEGER NOT NULL default 0,
            sp_line INTEGER NOT NULL default 0,
            sp_lineid INTEGER NOT NULL default 0,
            sp_itemid TEXT NOT NULL default '' COLLATE NOCASE,
            sp_customer TEXT NOT NULL default '' COLLATE NOCASE,
            sp_price INTEGER NOT NULL default 0,
            sp_qty INTEGER NOT NULL default 0,
            sp_unit TEXT NOT NULL default '' COLLATE NOCASE,
            sp_startdate TEXT NOT NULL default '' COLLATE NOCASE,
            sp_enddate TEXT NOT NULL default '' COLLATE NOCASE,
            sp_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            sp_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (sp_id, sp_line, sp_lineid, sp_itemid, sp_customer, sp_unit)
          );
          
CREATE TABLE IF NOT EXISTS REBATETYPES (
            rt_code TEXT NOT NULL default '',
            rt_name TEXT NOT NULL default '' COLLATE NOCASE,
            rt_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            rt_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (rt_code)
          );
          
CREATE TABLE IF NOT EXISTS MPRODADD (
            pa_prodid INTEGER NOT NULL default 0,
            pa_additem TEXT NOT NULL default '' COLLATE NOCASE,
            pa_unit TEXT NOT NULL default '' COLLATE NOCASE,
            pa_addqty INTEGER NOT NULL default 0,
            pa_addask INTEGER NOT NULL default 0,
            pa_addmul INTEGER NOT NULL default 0,
            pa_prodqty INTEGER NOT NULL default 0,
            pa_disctp TEXT NOT NULL default '' COLLATE NOCASE,
            pa_discval INTEGER NOT NULL default 0,
            pa_promoid TEXT NOT NULL default '' COLLATE NOCASE,
            pa_crdate TEXT NOT NULL default '' COLLATE NOCASE,
            pa_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            pa_addtext TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (pa_prodid, pa_additem, pa_unit)
          );
          
CREATE TABLE IF NOT EXISTS MNMASTER (
            mm_num INTEGER NOT NULL default 0,
            mm_text TEXT NOT NULL default '' COLLATE NOCASE,
            mm_type TEXT default '' COLLATE NOCASE, 
            mm_icon TEXT NOT NULL default '' COLLATE NOCASE,
            mm_prvlvl INTEGER default 0, 
            mm_param TEXT NOT NULL default '' COLLATE NOCASE,
            mm_command TEXT default '' COLLATE NOCASE, 
            mm_lastupd TEXT NOT NULL default '' COLLATE NOCASE, 
            PRIMARY KEY (mm_num)
          );
          
CREATE TABLE IF NOT EXISTS MAPICNF (
            keytype TEXT NOT NULL default '' COLLATE NOCASE,
            keymodule TEXT NOT NULL default '' COLLATE NOCASE,
            keyword TEXT NOT NULL default '',
            keystate TEXT NOT NULL default '' COLLATE NOCASE,
            keyaction TEXT NOT NULL default '' COLLATE NOCASE,
            keystring TEXT NOT NULL default '' COLLATE NOCASE,
            keyvalue TEXT NOT NULL default '' COLLATE NOCASE 
          );
          
CREATE TABLE IF NOT EXISTS MBATCH (
            bt_batchnum TEXT NOT NULL default '' COLLATE NOCASE,
            bt_itemid TEXT NOT NULL default '' COLLATE NOCASE,
            bt_whse TEXT NOT NULL default '' COLLATE NOCASE,
            bt_qty INTEGER NOT NULL default 0,
            bt_comqty INTEGER NOT NULL default 0,
            bt_expdate TEXT NOT NULL default '' COLLATE NOCASE,
            bt_lastupd TEXT NOT NULL default '' COLLATE NOCASE,
            PRIMARY KEY (bt_batchnum, bt_itemid)
          );