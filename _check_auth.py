import os, sys, time, django
sys.path.insert(0, '/Users/llallo/SistemasNovi')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.facturacion.models import Factura, ComprobanteElectronico
from apps.facturacion.services.sri_service import SRIService
from apps.facturacion.services.factura_service import _extraer_mensajes_autorizacion

f = Factura.objects.get(comprobante__numero_comprobante='001-001-000000012')
comp = f.comprobante
sri = SRIService(comp.empresa)
print('Clave:', comp.clave_acceso)

for intento in range(10):
    print(f'Intento {intento+1}/10...')
    auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
    if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
        aut = auth.autorizaciones.autorizacion[0]
        print('  Respuesta SRI:', aut.estado)
        if aut.estado == 'AUTORIZADO':
            comp.estado = ComprobanteElectronico.EstadoChoices.AUTORIZADO
            comp.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
            comp.fecha_autorizacion = getattr(aut, 'fechaAutorizacion', None)
            comp.mensajes_sri = ''
            comp.save()
            print('AUTORIZADA! Nro:', comp.numero_autorizacion)
            sys.exit(0)
        else:
            msgs = _extraer_mensajes_autorizacion(aut)
            print('  Mensajes:', ' | '.join(msgs))
            if aut.estado == 'NO_AUTORIZADO':
                comp.estado = ComprobanteElectronico.EstadoChoices.NO_AUTORIZADO
                comp.mensajes_sri = ' | '.join(msgs)
                comp.save()
                print('NO AUTORIZADA.')
                sys.exit(1)
    else:
        print('  Sin autorizaciones aun...')
    time.sleep(5)

print('Agotados los intentos. Queda en ENVIADO.')
