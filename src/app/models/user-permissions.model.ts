export interface UserPermissions {
  sidePanel: {
    personnel: boolean;
    userAccount: boolean;
    settings: boolean;
  };
  inventory: {
    addItem: boolean;
    updateItem: boolean;
    deleteItem: boolean;
    addCategory: boolean;
    updateCategory: boolean;
    deleteCategory: boolean;
    editItemCommission: boolean;
    viewCostPrice: boolean;
  };
  customer: {
    addCustomer: boolean;
    updateCustomer: boolean;
    deleteCustomer: boolean;
    deleteInactiveCustomer: boolean;
    deleteLendReturned: boolean;
  };
  personnel: {
    addPersonnel: boolean;
    updatePersonnel: boolean;
    deletePersonnel: boolean;
    viewRateSettings: boolean;
    paySalary: boolean;
  };
  transferItems: {
    supplier: boolean;
  };
  warehouse: {
    updateWarehouseItem: boolean;
  };
}

export type PermissionPath =
  | 'sidePanel.personnel'
  | 'sidePanel.userAccount'
  | 'sidePanel.settings'
  | 'inventory.addItem'
  | 'inventory.updateItem'
  | 'inventory.deleteItem'
  | 'inventory.addCategory'
  | 'inventory.updateCategory'
  | 'inventory.deleteCategory'
  | 'inventory.editItemCommission'
  | 'inventory.viewCostPrice'
  | 'customer.addCustomer'
  | 'customer.updateCustomer'
  | 'customer.deleteCustomer'
  | 'customer.deleteInactiveCustomer'
  | 'customer.deleteLendReturned'
  | 'personnel.addPersonnel'
  | 'personnel.updatePersonnel'
  | 'personnel.deletePersonnel'
  | 'personnel.viewRateSettings'
  | 'personnel.paySalary'
  | 'transferItems.supplier'
  | 'warehouse.updateWarehouseItem';

export const DEFAULT_PERMISSIONS: UserPermissions = {
  sidePanel: { personnel: true, userAccount: true, settings: true },
  inventory: {
    addItem: true,
    updateItem: true,
    deleteItem: true,
    addCategory: true,
    updateCategory: true,
    deleteCategory: true,
    editItemCommission: true,
    viewCostPrice: true,
  },
  customer: {
    addCustomer: true,
    updateCustomer: true,
    deleteCustomer: true,
    deleteInactiveCustomer: true,
    deleteLendReturned: true,
  },
  personnel: {
    addPersonnel: true,
    updatePersonnel: true,
    deletePersonnel: true,
    viewRateSettings: true,
    paySalary: true,
  },
  transferItems: { supplier: true },
  warehouse: { updateWarehouseItem: true },
};
