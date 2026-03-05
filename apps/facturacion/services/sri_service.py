"""
Servicio de Integración con el SRI
Genera XML, firma electrónicamente y envía comprobantes al SRI
"""
from lxml import etree
from datetime import datetime
from django.conf import settings
from django.utils import timezone
from signxml import XMLSigner, XMLVerifier
from cryptography.hazmat.primitives.serialization import pkcs12
import hashlib
import random
import os


class SRIService:
    """
    Servicio principal para interactuar con el SRI
    """
    
    # Códigos de impuestos
    CODIGO_IVA = '2'
    CODIGO_ICE = '3'
    
    # Tipos de comprobante
    TIPO_FACTURA = '01'
    TIPO_NOTA_CREDITO = '04'
    TIPO_NOTA_DEBITO = '05'
    TIPO_GUIA_REMISION = '06'
    TIPO_RETENCION = '07'
    
    def __init__(self, empresa):
        """
        Inicializa el servicio con una empresa específica
        """
        self.empresa = empresa
        self.ambiente = empresa.ambiente
    
    def generar_clave_acceso(self, fecha_emision, tipo_comprobante, ruc, ambiente, 
                            serie, numero_comprobante, codigo_numerico='12345678', 
                            tipo_emision='1'):
        """
        Genera la clave de acceso de 49 dígitos para el comprobante
        
        Formato: ddmmyyyyttcccccccccccrrrrrrrrrreesssssssssscnnnnnnnn
        - dd: día
        - mm: mes
        - yyyy: año
        - tt: tipo de comprobante
        - cccccccccccc: RUC
        - rrrrrrrrr: ambiente
        - ee: serie (establecimiento + punto emisión)
        - sssssssss: número secuencial
        - c: código numérico (8 dígitos)
        - nnnnnnnn: tipo de emisión
        """
        fecha_str = fecha_emision.strftime('%d%m%Y')
        serie_completa = serie.replace('-', '')  # 001001
        
        # Construir la clave sin dígito verificador
        clave_parcial = (
            f"{fecha_str}"
            f"{tipo_comprobante}"
            f"{ruc}"
            f"{ambiente}"
            f"{serie_completa}"
            f"{numero_comprobante}"
            f"{codigo_numerico}"
            f"{tipo_emision}"
        )
        
        # Calcular dígito verificador (módulo 11)
        digito_verificador = self._calcular_digito_verificador_modulo11(clave_parcial)
        
        clave_acceso = f"{clave_parcial}{digito_verificador}"
        
        return clave_acceso
    
    def _calcular_digito_verificador_modulo11(self, clave):
        """
        Calcula el dígito verificador usando módulo 11
        """
        factor = 7
        suma = 0
        
        for digito in reversed(clave):
            suma += int(digito) * factor
            factor = 2 if factor == 7 else factor + 1
        
        modulo = suma % 11
        digito_verificador = 11 - modulo
        
        if digito_verificador == 11:
            return 0
        elif digito_verificador == 10:
            return 1
        else:
            return digito_verificador
    
    def generar_xml_factura(self, factura):
        """
        Genera el XML de una factura según el esquema del SRI
        """
        from apps.facturacion.models import ComprobanteElectronico
        
        comprobante = factura.comprobante
        cliente = factura.cliente
        
        # Generar clave de acceso si no existe
        if not comprobante.clave_acceso:
            serie = f"{comprobante.establecimiento}-{comprobante.punto_emision}"
            comprobante.clave_acceso = self.generar_clave_acceso(
                fecha_emision=comprobante.fecha_emision,
                tipo_comprobante=self.TIPO_FACTURA,
                ruc=self.empresa.ruc,
                ambiente=self.ambiente,
                serie=serie,
                numero_comprobante=comprobante.secuencial,
                codigo_numerico=str(random.randint(10000000, 99999999))
            )
            comprobante.save(update_fields=['clave_acceso'])
        
        # Crear estructura XML
        nsmap = {None: 'http://www.sri.gob.ec/esquemas/factura/1.0.0'}
        factura_xml = etree.Element('factura', nsmap=nsmap, id='comprobante', version='1.0.0')
        
        # Información tributaria
        info_tributaria = etree.SubElement(factura_xml, 'infoTributaria')
        etree.SubElement(info_tributaria, 'ambiente').text = self.ambiente
        etree.SubElement(info_tributaria, 'tipoEmision').text = '1'
        etree.SubElement(info_tributaria, 'razonSocial').text = self.empresa.razon_social
        etree.SubElement(info_tributaria, 'nombreComercial').text = self.empresa.nombre_comercial or self.empresa.razon_social
        etree.SubElement(info_tributaria, 'ruc').text = self.empresa.ruc
        etree.SubElement(info_tributaria, 'claveAcceso').text = comprobante.clave_acceso
        etree.SubElement(info_tributaria, 'codDoc').text = self.TIPO_FACTURA
        etree.SubElement(info_tributaria, 'estab').text = comprobante.establecimiento
        etree.SubElement(info_tributaria, 'ptoEmi').text = comprobante.punto_emision
        etree.SubElement(info_tributaria, 'secuencial').text = comprobante.secuencial
        etree.SubElement(info_tributaria, 'dirMatriz').text = self.empresa.direccion_matriz
        
        # Información de la factura
        info_factura = etree.SubElement(factura_xml, 'infoFactura')
        etree.SubElement(info_factura, 'fechaEmision').text = comprobante.fecha_emision.strftime('%d/%m/%Y')
        etree.SubElement(info_factura, 'dirEstablecimiento').text = self.empresa.direccion_matriz
        
        if self.empresa.contribuyente_especial:
            etree.SubElement(info_factura, 'contribuyenteEspecial').text = self.empresa.contribuyente_especial
        
        etree.SubElement(info_factura, 'obligadoContabilidad').text = 'SI' if self.empresa.obligado_contabilidad else 'NO'
        etree.SubElement(info_factura, 'tipoIdentificacionComprador').text = cliente.tipo_identificacion
        etree.SubElement(info_factura, 'razonSocialComprador').text = cliente.razon_social
        etree.SubElement(info_factura, 'identificacionComprador').text = cliente.identificacion
        
        if cliente.direccion:
            etree.SubElement(info_factura, 'direccionComprador').text = cliente.direccion
        
        etree.SubElement(info_factura, 'totalSinImpuestos').text = f"{factura.subtotal_sin_impuestos:.2f}"
        etree.SubElement(info_factura, 'totalDescuento').text = f"{factura.total_descuento:.2f}"
        
        # Total con impuestos
        total_con_impuestos = etree.SubElement(info_factura, 'totalConImpuestos')
        
        # IVA 0%
        if factura.subtotal_0 > 0:
            total_impuesto = etree.SubElement(total_con_impuestos, 'totalImpuesto')
            etree.SubElement(total_impuesto, 'codigo').text = self.CODIGO_IVA
            etree.SubElement(total_impuesto, 'codigoPorcentaje').text = '0'
            etree.SubElement(total_impuesto, 'baseImponible').text = f"{factura.subtotal_0:.2f}"
            etree.SubElement(total_impuesto, 'valor').text = "0.00"
        
        # IVA 12%
        if factura.subtotal_12 > 0:
            total_impuesto = etree.SubElement(total_con_impuestos, 'totalImpuesto')
            etree.SubElement(total_impuesto, 'codigo').text = self.CODIGO_IVA
            etree.SubElement(total_impuesto, 'codigoPorcentaje').text = '2'
            etree.SubElement(total_impuesto, 'baseImponible').text = f"{factura.subtotal_12:.2f}"
            etree.SubElement(total_impuesto, 'valor').text = f"{factura.iva_12:.2f}"
        
        # IVA 15%
        if factura.subtotal_15 > 0:
            total_impuesto = etree.SubElement(total_con_impuestos, 'totalImpuesto')
            etree.SubElement(total_impuesto, 'codigo').text = self.CODIGO_IVA
            etree.SubElement(total_impuesto, 'codigoPorcentaje').text = '4'
            etree.SubElement(total_impuesto, 'baseImponible').text = f"{factura.subtotal_15:.2f}"
            etree.SubElement(total_impuesto, 'valor').text = f"{factura.iva_15:.2f}"
        
        etree.SubElement(info_factura, 'propina').text = "0.00"
        etree.SubElement(info_factura, 'importeTotal').text = f"{factura.total:.2f}"
        etree.SubElement(info_factura, 'moneda').text = 'DOLAR'
        
        # Pagos
        pagos = etree.SubElement(info_factura, 'pagos')
        pago = etree.SubElement(pagos, 'pago')
        etree.SubElement(pago, 'formaPago').text = factura.forma_pago
        etree.SubElement(pago, 'total').text = f"{factura.total:.2f}"
        
        # Detalles
        detalles = etree.SubElement(factura_xml, 'detalles')
        for detalle in factura.detalles.all():
            detalle_elem = etree.SubElement(detalles, 'detalle')
            etree.SubElement(detalle_elem, 'codigoPrincipal').text = detalle.codigo_principal
            
            if detalle.codigo_auxiliar:
                etree.SubElement(detalle_elem, 'codigoAuxiliar').text = detalle.codigo_auxiliar
            
            etree.SubElement(detalle_elem, 'descripcion').text = detalle.descripcion
            etree.SubElement(detalle_elem, 'cantidad').text = f"{detalle.cantidad:.6f}"
            etree.SubElement(detalle_elem, 'precioUnitario').text = f"{detalle.precio_unitario:.6f}"
            etree.SubElement(detalle_elem, 'descuento').text = f"{detalle.descuento:.2f}"
            etree.SubElement(detalle_elem, 'precioTotalSinImpuesto').text = f"{detalle.precio_total_sin_impuesto:.2f}"
            
            # Impuestos del detalle
            impuestos = etree.SubElement(detalle_elem, 'impuestos')
            impuesto = etree.SubElement(impuestos, 'impuesto')
            etree.SubElement(impuesto, 'codigo').text = detalle.codigo_impuesto
            etree.SubElement(impuesto, 'codigoPorcentaje').text = detalle.codigo_porcentaje
            etree.SubElement(impuesto, 'tarifa').text = f"{detalle.tarifa:.2f}"
            etree.SubElement(impuesto, 'baseImponible').text = f"{detalle.precio_total_sin_impuesto:.2f}"
            etree.SubElement(impuesto, 'valor').text = f"{detalle.valor_impuesto:.2f}"
        
        # Información adicional
        if factura.informacion_adicional:
            info_adicional = etree.SubElement(factura_xml, 'infoAdicional')
            for campo, valor in factura.informacion_adicional.items():
                campo_adicional = etree.SubElement(info_adicional, 'campoAdicional', nombre=campo)
                campo_adicional.text = str(valor)
        
        # Convertir a string
        xml_string = etree.tostring(
            factura_xml,
            pretty_print=True,
            xml_declaration=True,
            encoding='UTF-8'
        ).decode('utf-8')
        
        # Guardar XML generado
        comprobante.xml_generado = xml_string
        comprobante.save(update_fields=['xml_generado'])
        
        return xml_string
    
    def firmar_xml(self, xml_string):
        """
        Firma electrónicamente el XML con el certificado digital de la empresa.
        Usa signxml (enveloped, rsa-sha256) y la clave privada del .p12/.pfx.
        """
        from cryptography.hazmat.primitives import serialization as crypto_serial
        from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption

        if not self.empresa.certificado_digital:
            raise ValueError("La empresa no tiene configurado un certificado digital")

        cert_path = self.empresa.certificado_digital.path
        cert_password = self.empresa.password_certificado

        with open(cert_path, 'rb') as f:
            cert_data = f.read()

        # Cargar PKCS12
        private_key, certificate, _ = pkcs12.load_key_and_certificates(
            cert_data,
            cert_password.encode() if cert_password else None,
        )

        # Convertir a PEM para signxml (compatibilidad con signxml 3.x)
        key_pem  = private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption(),
        )
        cert_pem = certificate.public_bytes(Encoding.PEM)

        # Parse del XML
        root = etree.fromstring(xml_string.encode('utf-8'))

        # Firmar (method=enveloped es el default en signxml 3.x)
        signer = XMLSigner(
            signature_algorithm='rsa-sha256',
            digest_algorithm='sha256',
        )
        signed_root = signer.sign(root, key=key_pem, cert=cert_pem)

        return etree.tostring(
            signed_root,
            pretty_print=True,
            xml_declaration=True,
            encoding='UTF-8',
        ).decode('utf-8')
    
    def validar_xml_firmado(self, xml_firmado):
        """
        Valida la firma electrónica del XML
        """
        try:
            root = etree.fromstring(xml_firmado.encode('utf-8'))
            verified_data = XMLVerifier().verify(root)
            return True, "XML firmado válido"
        except Exception as e:
            return False, f"Error al validar firma: {str(e)}"
    
    def enviar_comprobante_sri(self, comprobante):
        """
        Envía el comprobante al SRI para recepción
        """
        from zeep import Client
        from zeep.transports import Transport
        from requests import Session
        
        # Determinar la URL según el ambiente
        if self.ambiente == '1':  # Pruebas
            url_recepcion = settings.SRI_PRUEBAS_RECEPCION_URL
        else:  # Producción
            url_recepcion = settings.SRI_PRODUCCION_RECEPCION_URL
        
        try:
            # Crear cliente SOAP
            session = Session()
            transport = Transport(session=session)
            client = Client(url_recepcion, transport=transport)
            
            # Enviar comprobante
            response = client.service.validarComprobante(comprobante.xml_firmado)
            
            return response
        except Exception as e:
            raise Exception(f"Error al enviar comprobante al SRI: {str(e)}")
    
    def autorizar_comprobante_sri(self, clave_acceso):
        """
        Consulta la autorización del comprobante en el SRI
        """
        from zeep import Client
        from zeep.transports import Transport
        from requests import Session
        
        # Determinar la URL según el ambiente
        if self.ambiente == '1':  # Pruebas
            url_autorizacion = settings.SRI_PRUEBAS_AUTORIZACION_URL
        else:  # Producción
            url_autorizacion = settings.SRI_PRODUCCION_AUTORIZACION_URL
        
        try:
            # Crear cliente SOAP
            session = Session()
            transport = Transport(session=session)
            client = Client(url_autorizacion, transport=transport)
            
            # Consultar autorización
            response = client.service.autorizacionComprobante(clave_acceso)
            
            return response
        except Exception as e:
            raise Exception(f"Error al consultar autorización en el SRI: {str(e)}")
