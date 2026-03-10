from decimal import Decimal
from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import CuentaContable, AsientoContable
from .serializers import (
    CuentaContableSerializer,
    CuentaContableTreeSerializer,
    AsientoContableSerializer,
    AsientoContableCreateSerializer,
)


class CuentaContableViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CuentaContableSerializer

    def get_queryset(self):
        return CuentaContable.objects.filter(
            empresa=self.request.user.empresa
        ).select_related('padre')

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)

    @action(detail=False, methods=['get'])
    def arbol(self, request):
        """Devuelve el plan de cuentas como árbol (nodos raíz con hijos anidados)."""
        raices = CuentaContable.objects.filter(
            empresa=request.user.empresa,
            padre=None,
            activa=True,
        ).order_by('codigo')
        return Response(CuentaContableTreeSerializer(raices, many=True).data)

    @action(detail=False, methods=['post'])
    def inicializar(self, request):
        """Crea el plan de cuentas estándar NEC Ecuador si no existe."""
        empresa = request.user.empresa
        if CuentaContable.objects.filter(empresa=empresa).exists():
            return Response({'detail': 'El plan de cuentas ya existe.'}, status=status.HTTP_400_BAD_REQUEST)

        PLAN = [
            # (codigo, nombre, tipo, naturaleza, nivel, padre_codigo)
            ('1',      'ACTIVOS',                                  'ACTIVO',     'DEUDORA',   1, None),
            ('1.1',    'ACTIVO CORRIENTE',                         'ACTIVO',     'DEUDORA',   2, '1'),
            ('1.1.01', 'CAJA Y BANCOS',                            'ACTIVO',     'DEUDORA',   3, '1.1'),
            ('1.1.02', 'CUENTAS Y DOCUMENTOS POR COBRAR',          'ACTIVO',     'DEUDORA',   3, '1.1'),
            ('1.1.03', 'INVENTARIO DE MERCADERÍAS',                'ACTIVO',     'DEUDORA',   3, '1.1'),
            ('1.1.04', 'IVA EN COMPRAS',                           'ACTIVO',     'DEUDORA',   3, '1.1'),
            ('1.1.05', 'RETENCIÓN IVA COBRAR',                     'ACTIVO',     'DEUDORA',   3, '1.1'),
            ('1.1.06', 'ANTICIPO PROVEEDORES',                     'ACTIVO',     'DEUDORA',   3, '1.1'),
            ('1.2',    'ACTIVO NO CORRIENTE',                      'ACTIVO',     'DEUDORA',   2, '1'),
            ('1.2.01', 'PROPIEDAD, PLANTA Y EQUIPO',               'ACTIVO',     'DEUDORA',   3, '1.2'),
            ('1.2.02', 'DEPRECIACIÓN ACUMULADA',                   'ACTIVO',     'ACREEDORA', 3, '1.2'),
            ('2',      'PASIVOS',                                  'PASIVO',     'ACREEDORA', 1, None),
            ('2.1',    'PASIVO CORRIENTE',                         'PASIVO',     'ACREEDORA', 2, '2'),
            ('2.1.01', 'CUENTAS Y DOCUMENTOS POR PAGAR',           'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.1.02', 'IVA EN VENTAS',                            'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.1.03', 'RETENCIÓN RENTA POR PAGAR',                'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.1.04', 'RETENCIÓN IVA POR PAGAR',                  'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.1.05', 'SRI POR PAGAR',                            'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.1.06', 'SUELDOS Y SALARIOS POR PAGAR',             'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.1.07', 'IESS SEGURO SOCIAL POR PAGAR',             'PASIVO',     'ACREEDORA', 3, '2.1'),
            ('2.2',    'PASIVO NO CORRIENTE',                      'PASIVO',     'ACREEDORA', 2, '2'),
            ('2.2.01', 'PRÉSTAMOS A LARGO PLAZO',                  'PASIVO',     'ACREEDORA', 3, '2.2'),
            ('3',      'PATRIMONIO',                               'PATRIMONIO', 'ACREEDORA', 1, None),
            ('3.1',    'CAPITAL SOCIAL',                           'PATRIMONIO', 'ACREEDORA', 2, '3'),
            ('3.1.01', 'CAPITAL SUSCRITO Y PAGADO',                'PATRIMONIO', 'ACREEDORA', 3, '3.1'),
            ('3.2',    'RESULTADOS',                               'PATRIMONIO', 'ACREEDORA', 2, '3'),
            ('3.2.01', 'UTILIDAD DEL EJERCICIO',                   'PATRIMONIO', 'ACREEDORA', 3, '3.2'),
            ('3.2.02', 'PÉRDIDA DEL EJERCICIO',                    'PATRIMONIO', 'DEUDORA',   3, '3.2'),
            ('3.2.03', 'UTILIDADES ANTERIORES',                    'PATRIMONIO', 'ACREEDORA', 3, '3.2'),
            ('4',      'INGRESOS',                                 'INGRESO',    'ACREEDORA', 1, None),
            ('4.1',    'INGRESOS OPERACIONALES',                   'INGRESO',    'ACREEDORA', 2, '4'),
            ('4.1.01', 'VENTAS NETAS',                             'INGRESO',    'ACREEDORA', 3, '4.1'),
            ('4.1.02', 'DESCUENTO EN VENTAS',                      'INGRESO',    'DEUDORA',   3, '4.1'),
            ('4.2',    'INGRESOS NO OPERACIONALES',                'INGRESO',    'ACREEDORA', 2, '4'),
            ('4.2.01', 'INTERESES GANADOS',                        'INGRESO',    'ACREEDORA', 3, '4.2'),
            ('5',      'COSTOS',                                   'COSTO',      'DEUDORA',   1, None),
            ('5.1',    'COSTO DE VENTAS',                          'COSTO',      'DEUDORA',   2, '5'),
            ('5.1.01', 'COSTO DE MERCADERÍAS VENDIDAS',            'COSTO',      'DEUDORA',   3, '5.1'),
            ('6',      'GASTOS',                                   'GASTO',      'DEUDORA',   1, None),
            ('6.1',    'GASTOS OPERACIONALES',                     'GASTO',      'DEUDORA',   2, '6'),
            ('6.1.01', 'SUELDOS Y SALARIOS',                       'GASTO',      'DEUDORA',   3, '6.1'),
            ('6.1.02', 'APORTE PATRONAL IESS',                     'GASTO',      'DEUDORA',   3, '6.1'),
            ('6.1.03', 'ARRIENDOS',                                'GASTO',      'DEUDORA',   3, '6.1'),
            ('6.1.04', 'SERVICIOS BÁSICOS',                        'GASTO',      'DEUDORA',   3, '6.1'),
            ('6.1.05', 'DEPRECIACIÓN',                             'GASTO',      'DEUDORA',   3, '6.1'),
            ('6.1.06', 'SUMINISTROS Y MATERIALES',                 'GASTO',      'DEUDORA',   3, '6.1'),
            ('6.2',    'GASTOS NO OPERACIONALES',                  'GASTO',      'DEUDORA',   2, '6'),
            ('6.2.01', 'INTERESES BANCARIOS',                      'GASTO',      'DEUDORA',   3, '6.2'),
            ('6.2.02', 'OTROS GASTOS',                             'GASTO',      'DEUDORA',   3, '6.2'),
        ]

        # Determinar qué cuentas son hoja (no tienen hijos en el plan)
        padres = {row[5] for row in PLAN if row[5]}
        creadas = {}

        for codigo, nombre, tipo, naturaleza, nivel, padre_codigo in PLAN:
            padre = creadas.get(padre_codigo)
            es_hoja = codigo not in padres
            cuenta = CuentaContable.objects.create(
                empresa=empresa,
                padre=padre,
                codigo=codigo,
                nombre=nombre,
                tipo=tipo,
                naturaleza=naturaleza,
                nivel=nivel,
                es_hoja=es_hoja,
            )
            creadas[codigo] = cuenta

        return Response({'detail': f'{len(PLAN)} cuentas creadas correctamente.'}, status=status.HTTP_201_CREATED)


class AsientoContableViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = AsientoContable.objects.filter(
            empresa=self.request.user.empresa
        ).prefetch_related('lineas__cuenta')
        anio = self.request.query_params.get('anio')
        mes  = self.request.query_params.get('mes')
        tipo = self.request.query_params.get('tipo')
        if anio:
            qs = qs.filter(fecha__year=anio)
        if mes:
            qs = qs.filter(fecha__month=mes)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AsientoContableCreateSerializer
        return AsientoContableSerializer

    @action(detail=True, methods=['post'])
    def bloquear(self, request, pk=None):
        asiento = self.get_object()
        if not asiento.cuadrado:
            return Response({'detail': 'No se puede bloquear un asiento descuadrado.'}, status=400)
        asiento.bloqueado = True
        asiento.save()
        return Response({'detail': 'Asiento bloqueado.'})

    @action(detail=False, methods=['get'])
    def balance_general(self, request):
        """
        Devuelve el Balance General agrupado (Activo, Pasivo, Patrimonio).
        Query params: al=YYYY-MM-DD (fecha corte, default hoy)
        """
        from django.utils import timezone
        empresa = request.user.empresa
        al = request.query_params.get('al')

        cuentas_qs = CuentaContable.objects.filter(empresa=empresa, activa=True)

        def _saldo(cuenta):
            lineas = cuenta.lineas.all()
            if al:
                lineas = lineas.filter(asiento__fecha__lte=al)
            agg = lineas.aggregate(d=Sum('debe'), h=Sum('haber'))
            d = agg['d'] or Decimal('0.00')
            h = agg['h'] or Decimal('0.00')
            if cuenta.naturaleza == 'DEUDORA':
                return d - h
            return h - d

        def _grupo(tipo):
            rows = []
            for c in cuentas_qs.filter(tipo=tipo, es_hoja=True).order_by('codigo'):
                s = _saldo(c)
                rows.append({'codigo': c.codigo, 'nombre': c.nombre, 'saldo': float(s)})
            total = sum(r['saldo'] for r in rows)
            return {'cuentas': rows, 'total': total}

        activo     = _grupo('ACTIVO')
        pasivo     = _grupo('PASIVO')
        patrimonio = _grupo('PATRIMONIO')

        return Response({
            'al': al or str(timezone.now().date()),
            'activo':     activo,
            'pasivo':     pasivo,
            'patrimonio': patrimonio,
            'total_pasivo_patrimonio': pasivo['total'] + patrimonio['total'],
            'cuadra': abs(activo['total'] - (pasivo['total'] + patrimonio['total'])) < 0.01,
        })

    @action(detail=False, methods=['get'])
    def estado_resultados(self, request):
        """
        Estado de Resultados para un período.
        Query params: anio, mes (opcional)
        """
        empresa = request.user.empresa
        anio = request.query_params.get('anio')
        mes  = request.query_params.get('mes')

        cuentas_qs = CuentaContable.objects.filter(empresa=empresa, activa=True, es_hoja=True)

        def _filtrar_lineas(tipo):
            rows = []
            for c in cuentas_qs.filter(tipo=tipo).order_by('codigo'):
                lineas = c.lineas.all()
                if anio:
                    lineas = lineas.filter(asiento__fecha__year=anio)
                if mes:
                    lineas = lineas.filter(asiento__fecha__month=mes)
                agg = lineas.aggregate(d=Sum('debe'), h=Sum('haber'))
                d = agg['d'] or Decimal('0.00')
                h = agg['h'] or Decimal('0.00')
                saldo = (h - d) if tipo == 'INGRESO' else (d - h)
                rows.append({'codigo': c.codigo, 'nombre': c.nombre, 'saldo': float(saldo)})
            return rows, sum(r['saldo'] for r in rows)

        ingresos_rows, total_ingresos = _filtrar_lineas('INGRESO')
        costos_rows,   total_costos   = _filtrar_lineas('COSTO')
        gastos_rows,   total_gastos   = _filtrar_lineas('GASTO')

        utilidad_bruta = total_ingresos - total_costos
        utilidad_neta  = utilidad_bruta - total_gastos

        return Response({
            'anio': anio,
            'mes':  mes,
            'ingresos': {'cuentas': ingresos_rows, 'total': total_ingresos},
            'costos':   {'cuentas': costos_rows,   'total': total_costos},
            'gastos':   {'cuentas': gastos_rows,   'total': total_gastos},
            'utilidad_bruta': utilidad_bruta,
            'utilidad_neta':  utilidad_neta,
        })

    @action(detail=False, methods=['get'])
    def libro_mayor(self, request):
        """
        Movimientos de una cuenta con saldo acumulado.
        Query params: cuenta_id (required), anio, mes
        """
        cuenta_id = request.query_params.get('cuenta_id')
        if not cuenta_id:
            return Response({'detail': 'Se requiere cuenta_id.'}, status=400)

        try:
            cuenta = CuentaContable.objects.get(pk=cuenta_id, empresa=request.user.empresa)
        except CuentaContable.DoesNotExist:
            return Response({'detail': 'Cuenta no encontrada.'}, status=404)

        lineas = cuenta.lineas.select_related('asiento').order_by('asiento__fecha', 'id')
        anio = request.query_params.get('anio')
        mes  = request.query_params.get('mes')
        if anio:
            lineas = lineas.filter(asiento__fecha__year=anio)
        if mes:
            lineas = lineas.filter(asiento__fecha__month=mes)

        saldo_acum = Decimal('0.00')
        movimientos = []
        for l in lineas:
            movimiento = l.debe - l.haber if cuenta.naturaleza == 'DEUDORA' else l.haber - l.debe
            saldo_acum += movimiento
            movimientos.append({
                'fecha':       l.asiento.fecha,
                'numero':      l.asiento.numero,
                'descripcion': l.descripcion or l.asiento.descripcion,
                'debe':        float(l.debe),
                'haber':       float(l.haber),
                'saldo':       float(saldo_acum),
            })

        return Response({
            'cuenta': {'id': cuenta.id, 'codigo': cuenta.codigo, 'nombre': cuenta.nombre},
            'movimientos': movimientos,
        })
