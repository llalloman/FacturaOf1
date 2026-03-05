from rest_framework import permissions


class CanManageProveedores(permissions.BasePermission):
    """
    Permiso para gestionar proveedores
    Requiere rol: ADMIN_EMPRESA, CONTADOR
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Lectura permitida para todos los roles
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Escritura solo para ADMIN_EMPRESA y CONTADOR
        return request.user.rol in ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CONTADOR']


class CanManageOrdenesCompra(permissions.BasePermission):
    """
    Permiso para gestionar órdenes de compra
    Requiere rol: ADMIN_EMPRESA, CONTADOR
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Lectura permitida para todos
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Escritura solo para ADMIN_EMPRESA y CONTADOR
        return request.user.rol in ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CONTADOR']


class CanManageRecepciones(permissions.BasePermission):
    """
    Permiso para gestionar recepciones de compra
    Requiere rol: ADMIN_EMPRESA, CONTADOR, VENDEDOR (para recibir)
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Lectura permitida para todos
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Escritura para ADMIN_EMPRESA, CONTADOR, VENDEDOR
        return request.user.rol in [
            'SUPER_ADMIN', 'ADMIN_EMPRESA', 'CONTADOR', 'VENDEDOR'
        ]


class CanManageCuentasPorPagar(permissions.BasePermission):
    """
    Permiso para gestionar cuentas por pagar
    Requiere rol: ADMIN_EMPRESA, CONTADOR
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Lectura permitida para todos
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Escritura solo para ADMIN_EMPRESA y CONTADOR
        return request.user.rol in ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CONTADOR']


class CanManagePagos(permissions.BasePermission):
    """
    Permiso para gestionar pagos a proveedores
    Requiere rol: ADMIN_EMPRESA, CONTADOR
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Lectura permitida para todos
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Escritura solo para ADMIN_EMPRESA y CONTADOR
        # (los pagos son operaciones financieras sensibles)
        return request.user.rol in ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'CONTADOR']
