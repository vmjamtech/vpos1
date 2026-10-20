import { BehaviorSubject } from 'rxjs';
import { UserService } from './user.service';
import { PermissionService } from './permission.service';

const STORAGE_KEY = 'vpos-user-permissions';

describe('PermissionService', () => {
  let currentUser: BehaviorSubject<any>;
  let service: PermissionService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    currentUser = new BehaviorSubject<any>(null);
    service = new PermissionService({ currentUser$: currentUser.asObservable() } as UserService);
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('defaults permissions to enabled for existing users', () => {
    currentUser.next({ userid: 12, accnttype: 'CASHIER' });

    expect(service.has('inventory.addItem')).toBeTrue();
    expect(service.has('customer.deleteCustomer')).toBeTrue();
    expect(service.has('pos.shortcut_edit')).toBeTrue();
    expect(service.has('pos.shortcut_delete')).toBeTrue();
    expect(service.has('report.simulation_settings')).toBeTrue();
  });

  it('allows only administrator accounts to assign permissions', () => {
    currentUser.next({ userid: 1, accnttype: 'manager' });
    expect(service.canAssignPermissions).toBeFalse();

    currentUser.next({ userid: 2, accnttype: 'Administrator' });
    expect(service.canAssignPermissions).toBeTrue();
  });

  it('persists permissions per user and applies them to the current account', () => {
    const administrator = { userid: 1, accnttype: 'ADMINISTRATOR' };
    const cashier = { userid: 2, usern: 'cashier', accnttype: 'CASHIER' };
    currentUser.next(administrator);

    const permissions = service.getForUser(cashier);
    permissions.inventory.updateItem = false;
    service.saveForUser(cashier, permissions);

    currentUser.next(cashier);
    expect(service.has('inventory.updateItem')).toBeFalse();
    expect(service.has('inventory.addItem')).toBeTrue();
  });

  it('always grants the master superadmin full permissions', () => {
    currentUser.next({ userid: 7, accnttype: 'ADMINISTRATOR' });
    const restricted = service.getForUser({ userid: 'vmjamadmin', usern: 'vmjamadmin' });
    restricted.inventory.deleteItem = false;
    service.saveForUser({ userid: 'vmjamadmin', usern: 'vmjamadmin' }, restricted);

    currentUser.next({ userid: 'vmjamadmin', usern: 'vmjamadmin', accnttype: 'STAFF' });
    expect(service.has('inventory.deleteItem')).toBeTrue();
    expect(service.canAssignPermissions).toBeTrue();
  });
});
