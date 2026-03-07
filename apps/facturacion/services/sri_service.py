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
        fecha_local = timezone.localtime(fecha_emision) if timezone.is_aware(fecha_emision) else fecha_emision
        fecha_str = fecha_local.strftime('%d%m%Y')
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
        Calcula el dígito verificador usando módulo 11.
        El SRI asigna pesos 2,3,4,5,6,7,2,3,... de derecha a izquierda
        empezando con peso 2 para el dígito más a la derecha.
        """
        factor = 2
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
        
        # Generar (o regenerar) clave de acceso para comprobantes no autorizados.
        # Si la clave ya existe y el comprobante está AUTORIZADO, se preserva.
        if not comprobante.clave_acceso or comprobante.estado not in ('AUTORIZADO', 'ENVIADO'):
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
        
        # Crear estructura XML (SRI requiere sin namespace)
        factura_xml = etree.Element('factura', id='comprobante', version='1.0.0')
        
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
        etree.SubElement(info_factura, 'fechaEmision').text = timezone.localtime(comprobante.fecha_emision).strftime('%d/%m/%Y')
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
        
        # Información adicional — primero campos estándar del cliente, luego los de la factura
        campos_adicionales = {}
        if cliente.email:
            campos_adicionales['email'] = cliente.email
        if cliente.telefono:
            campos_adicionales['telefono'] = cliente.telefono
        if cliente.celular:
            campos_adicionales['celular'] = cliente.celular
        if factura.informacion_adicional:
            campos_adicionales.update(factura.informacion_adicional)
        if campos_adicionales:
            info_adicional = etree.SubElement(factura_xml, 'infoAdicional')
            for campo, valor in campos_adicionales.items():
                campo_adicional = etree.SubElement(info_adicional, 'campoAdicional', nombre=campo)
                campo_adicional.text = str(valor)
        
        # Convertir a string (sin pretty_print: el whitespace rompe los digests de la firma)
        xml_string = etree.tostring(
            factura_xml,
            pretty_print=False,
            xml_declaration=True,
            encoding='UTF-8'
        ).decode('utf-8')
        
        # Guardar XML generado
        comprobante.xml_generado = xml_string
        comprobante.save(update_fields=['xml_generado'])
        
        return xml_string

    def generar_xml_nota_credito(self, nota_credito):
        """
        Genera el XML de una Nota de Crédito Electrónica (codDoc=04) según el SRI.
        Referencia: Ficha Técnica SRI v2.32 — Nota de Crédito.
        """
        TIPO_NC = '04'
        comprobante    = nota_credito.comprobante
        factura_origen = nota_credito.factura_origen
        cliente        = factura_origen.cliente

        # Generar (o regenerar) clave de acceso para NCs no autorizadas.
        if not comprobante.clave_acceso or comprobante.estado not in ('AUTORIZADO', 'ENVIADO'):
            serie = f"{comprobante.establecimiento}-{comprobante.punto_emision}"
            comprobante.clave_acceso = self.generar_clave_acceso(
                fecha_emision=comprobante.fecha_emision,
                tipo_comprobante=TIPO_NC,
                ruc=self.empresa.ruc,
                ambiente=self.ambiente,
                serie=serie,
                numero_comprobante=comprobante.secuencial,
                codigo_numerico=str(random.randint(10000000, 99999999)),
            )
            comprobante.save(update_fields=['clave_acceso'])

        nc_xml = etree.Element('notaCredito', id='comprobante', version='1.0.0')

        # ── infoTributaria ────────────────────────────────────────────────────
        info_trib = etree.SubElement(nc_xml, 'infoTributaria')
        etree.SubElement(info_trib, 'ambiente').text       = self.ambiente
        etree.SubElement(info_trib, 'tipoEmision').text    = '1'
        etree.SubElement(info_trib, 'razonSocial').text    = self.empresa.razon_social
        etree.SubElement(info_trib, 'nombreComercial').text = self.empresa.nombre_comercial or self.empresa.razon_social
        etree.SubElement(info_trib, 'ruc').text            = self.empresa.ruc
        etree.SubElement(info_trib, 'claveAcceso').text    = comprobante.clave_acceso
        etree.SubElement(info_trib, 'codDoc').text         = TIPO_NC
        etree.SubElement(info_trib, 'estab').text          = comprobante.establecimiento
        etree.SubElement(info_trib, 'ptoEmi').text         = comprobante.punto_emision
        etree.SubElement(info_trib, 'secuencial').text     = comprobante.secuencial
        etree.SubElement(info_trib, 'dirMatriz').text      = self.empresa.direccion_matriz

        # ── infoNotaCredito ───────────────────────────────────────────────────
        info_nc = etree.SubElement(nc_xml, 'infoNotaCredito')
        etree.SubElement(info_nc, 'fechaEmision').text = timezone.localtime(comprobante.fecha_emision).strftime('%d/%m/%Y')
        etree.SubElement(info_nc, 'dirEstablecimiento').text = self.empresa.direccion_matriz
        etree.SubElement(info_nc, 'tipoIdentificacionComprador').text = cliente.tipo_identificacion
        etree.SubElement(info_nc, 'razonSocialComprador').text = cliente.razon_social
        etree.SubElement(info_nc, 'identificacionComprador').text = cliente.identificacion

        if self.empresa.contribuyente_especial:
            etree.SubElement(info_nc, 'contribuyenteEspecial').text = self.empresa.contribuyente_especial

        etree.SubElement(info_nc, 'obligadoContabilidad').text = 'SI' if self.empresa.obligado_contabilidad else 'NO'
        etree.SubElement(info_nc, 'codDocModificado').text = '01'  # 01 = Factura
        etree.SubElement(info_nc, 'numDocModificado').text = factura_origen.comprobante.numero_comprobante
        etree.SubElement(info_nc, 'fechaEmisionDocSustento').text = timezone.localtime(factura_origen.comprobante.fecha_emision).strftime('%d/%m/%Y')
        etree.SubElement(info_nc, 'totalSinImpuestos').text = f"{nota_credito.subtotal_sin_impuestos:.2f}"
        etree.SubElement(info_nc, 'valorModificacion').text = f"{nota_credito.total:.2f}"
        etree.SubElement(info_nc, 'moneda').text = 'DOLAR'

        # totalConImpuestos — agrupado por (codigo, codigoPorcentaje, tarifa)
        total_con_imp = etree.SubElement(info_nc, 'totalConImpuestos')
        from collections import defaultdict
        from decimal import Decimal as _D
        totals: dict = defaultdict(lambda: {'base': _D('0.00'), 'valor': _D('0.00')})
        for det in nota_credito.detalles.all():
            key = (det.codigo_impuesto, det.codigo_porcentaje, det.tarifa)
            totals[key]['base']  += det.precio_total_sin_impuesto
            totals[key]['valor'] += det.valor_impuesto
        for (cod, cod_pct, _tarifa), vals in totals.items():
            ti = etree.SubElement(total_con_imp, 'totalImpuesto')
            etree.SubElement(ti, 'codigo').text           = cod
            etree.SubElement(ti, 'codigoPorcentaje').text = cod_pct
            etree.SubElement(ti, 'baseImponible').text    = f"{vals['base']:.2f}"
            etree.SubElement(ti, 'valor').text            = f"{vals['valor']:.2f}"

        etree.SubElement(info_nc, 'motivo').text = nota_credito.motivo

        # ── detalles ──────────────────────────────────────────────────────────
        detalles_el = etree.SubElement(nc_xml, 'detalles')
        for det in nota_credito.detalles.all():
            det_el = etree.SubElement(detalles_el, 'detalle')
            etree.SubElement(det_el, 'codigoInterno').text            = det.codigo_principal
            etree.SubElement(det_el, 'descripcion').text              = det.descripcion
            etree.SubElement(det_el, 'cantidad').text                 = f"{det.cantidad:.6f}"
            etree.SubElement(det_el, 'precioUnitario').text           = f"{det.precio_unitario:.6f}"
            etree.SubElement(det_el, 'descuento').text                = f"{det.descuento:.2f}"
            etree.SubElement(det_el, 'precioTotalSinImpuesto').text   = f"{det.precio_total_sin_impuesto:.2f}"
            imp_el = etree.SubElement(etree.SubElement(det_el, 'impuestos'), 'impuesto')
            etree.SubElement(imp_el, 'codigo').text           = det.codigo_impuesto
            etree.SubElement(imp_el, 'codigoPorcentaje').text = det.codigo_porcentaje
            etree.SubElement(imp_el, 'tarifa').text           = f"{det.tarifa:.2f}"
            etree.SubElement(imp_el, 'baseImponible').text    = f"{det.precio_total_sin_impuesto:.2f}"
            etree.SubElement(imp_el, 'valor').text            = f"{det.valor_impuesto:.2f}"

        # ── infoAdicional (email/teléfono cliente) ────────────────────────────
        campos: dict = {}
        if cliente.email:
            campos['email'] = cliente.email
        if cliente.telefono:
            campos['telefono'] = cliente.telefono
        if campos:
            info_adic = etree.SubElement(nc_xml, 'infoAdicional')
            for nombre, valor in campos.items():
                etree.SubElement(info_adic, 'campoAdicional', nombre=nombre).text = str(valor)

        xml_string = etree.tostring(
            nc_xml, pretty_print=False, xml_declaration=True, encoding='UTF-8',
        ).decode('utf-8')
        comprobante.xml_generado = xml_string
        comprobante.save(update_fields=['xml_generado'])
        return xml_string

    def generar_xml_guia_remision(self, guia):
        """
        Genera el XML de una Guía de Remisión (codDoc=06) según el SRI.
        Referencia: Ficha Técnica SRI v2.x — Guía de Remisión.
        """
        TIPO_GR = '06'
        comprobante = guia.comprobante

        if not comprobante.clave_acceso or comprobante.estado not in ('AUTORIZADO', 'ENVIADO'):
            serie = f"{comprobante.establecimiento}-{comprobante.punto_emision}"
            comprobante.clave_acceso = self.generar_clave_acceso(
                fecha_emision=comprobante.fecha_emision,
                tipo_comprobante=TIPO_GR,
                ruc=self.empresa.ruc,
                ambiente=self.ambiente,
                serie=serie,
                numero_comprobante=comprobante.secuencial,
                codigo_numerico=str(random.randint(10000000, 99999999)),
            )
            comprobante.save(update_fields=['clave_acceso'])

        gr_xml = etree.Element('guiaRemision', id='comprobante', version='1.1.0')

        # ── infoTributaria ────────────────────────────────────────────────────
        info_trib = etree.SubElement(gr_xml, 'infoTributaria')
        etree.SubElement(info_trib, 'ambiente').text        = self.ambiente
        etree.SubElement(info_trib, 'tipoEmision').text     = '1'
        etree.SubElement(info_trib, 'razonSocial').text     = self.empresa.razon_social
        etree.SubElement(info_trib, 'nombreComercial').text = self.empresa.nombre_comercial or self.empresa.razon_social
        etree.SubElement(info_trib, 'ruc').text             = self.empresa.ruc
        etree.SubElement(info_trib, 'claveAcceso').text     = comprobante.clave_acceso
        etree.SubElement(info_trib, 'codDoc').text          = TIPO_GR
        etree.SubElement(info_trib, 'estab').text           = comprobante.establecimiento
        etree.SubElement(info_trib, 'ptoEmi').text          = comprobante.punto_emision
        etree.SubElement(info_trib, 'secuencial').text      = comprobante.secuencial
        etree.SubElement(info_trib, 'dirMatriz').text       = self.empresa.direccion_matriz

        # ── infoGuiaRemision ──────────────────────────────────────────────────
        info_gr = etree.SubElement(gr_xml, 'infoGuiaRemision')
        etree.SubElement(info_gr, 'dirPartida').text                = guia.dir_partida
        etree.SubElement(info_gr, 'razonSocialTransportista').text  = guia.razon_social_transportista
        etree.SubElement(info_gr, 'tipoIdentificacionTransportista').text = '04'  # RUC
        etree.SubElement(info_gr, 'rucTransportista').text          = guia.ruc_transportista

        if self.empresa.contribuyente_especial:
            etree.SubElement(info_gr, 'contribuyenteEspecial').text = self.empresa.contribuyente_especial

        etree.SubElement(info_gr, 'obligadoContabilidad').text = 'SI' if self.empresa.obligado_contabilidad else 'NO'
        etree.SubElement(info_gr, 'fechaIniTransporte').text   = guia.fecha_inicio_transporte.strftime('%d/%m/%Y')
        etree.SubElement(info_gr, 'fechaFinTransporte').text   = guia.fecha_fin_transporte.strftime('%d/%m/%Y')
        etree.SubElement(info_gr, 'placa').text               = guia.placa

        # ── destinatarios ─────────────────────────────────────────────────────
        destinatarios_el = etree.SubElement(gr_xml, 'destinatarios')
        for dest in guia.destinatarios.all():
            dest_el = etree.SubElement(destinatarios_el, 'destinatario')
            etree.SubElement(dest_el, 'identificacionDestinatario').text = dest.identificacion_destinatario
            etree.SubElement(dest_el, 'razonSocialDestinatario').text    = dest.razon_social_destinatario
            etree.SubElement(dest_el, 'dirDestinatario').text            = dest.dir_dest_destinatario
            etree.SubElement(dest_el, 'motivoTraslado').text             = dest.motorista_y_ca
            if dest.ruta:
                etree.SubElement(dest_el, 'ruta').text = dest.ruta
            etree.SubElement(dest_el, 'codDocSustento').text  = dest.cod_doc_sustento
            if dest.num_doc_sustento:
                etree.SubElement(dest_el, 'numDocSustento').text = dest.num_doc_sustento
            if dest.fecha_emision_doc_sust:
                etree.SubElement(dest_el, 'fechaEmisionDocSustento').text = dest.fecha_emision_doc_sust.strftime('%d/%m/%Y')
            if dest.num_autorizacion_doc_sust:
                etree.SubElement(dest_el, 'numAutDocSustento').text = dest.num_autorizacion_doc_sust

            detalles_el = etree.SubElement(dest_el, 'detalles')
            for det in dest.detalles.all():
                det_el = etree.SubElement(detalles_el, 'detalle')
                etree.SubElement(det_el, 'codigoInterno').text = det.codigo_interno
                etree.SubElement(det_el, 'descripcion').text   = det.descripcion
                etree.SubElement(det_el, 'cantidad').text      = f"{det.cantidad:.6f}"

        xml_string = etree.tostring(
            gr_xml, pretty_print=False, xml_declaration=True, encoding='UTF-8',
        ).decode('utf-8')
        comprobante.xml_generado = xml_string
        comprobante.save(update_fields=['xml_generado'])
        return xml_string

    def generar_xml_retencion(self, retencion):
        Referencia: Ficha Técnica SRI v2.x — Comprobante de Retención.
        """
        TIPO_RET = '07'
        comprobante = retencion.comprobante
        sujeto = retencion.proveedor

        # Generar clave de acceso si no existe o si está en borrador
        if not comprobante.clave_acceso or comprobante.estado not in ('AUTORIZADO', 'ENVIADO'):
            serie = f"{comprobante.establecimiento}-{comprobante.punto_emision}"
            comprobante.clave_acceso = self.generar_clave_acceso(
                fecha_emision=comprobante.fecha_emision,
                tipo_comprobante=TIPO_RET,
                ruc=self.empresa.ruc,
                ambiente=self.ambiente,
                serie=serie,
                numero_comprobante=comprobante.secuencial,
                codigo_numerico=str(random.randint(10000000, 99999999)),
            )
            comprobante.save(update_fields=['clave_acceso'])

        ret_xml = etree.Element('comprobanteRetencion', id='comprobante', version='1.0.0')

        # ── infoTributaria ────────────────────────────────────────────────────
        info_trib = etree.SubElement(ret_xml, 'infoTributaria')
        etree.SubElement(info_trib, 'ambiente').text        = self.ambiente
        etree.SubElement(info_trib, 'tipoEmision').text     = '1'
        etree.SubElement(info_trib, 'razonSocial').text     = self.empresa.razon_social
        etree.SubElement(info_trib, 'nombreComercial').text = self.empresa.nombre_comercial or self.empresa.razon_social
        etree.SubElement(info_trib, 'ruc').text             = self.empresa.ruc
        etree.SubElement(info_trib, 'claveAcceso').text     = comprobante.clave_acceso
        etree.SubElement(info_trib, 'codDoc').text          = TIPO_RET
        etree.SubElement(info_trib, 'estab').text           = comprobante.establecimiento
        etree.SubElement(info_trib, 'ptoEmi').text          = comprobante.punto_emision
        etree.SubElement(info_trib, 'secuencial').text      = comprobante.secuencial
        etree.SubElement(info_trib, 'dirMatriz').text       = self.empresa.direccion_matriz

        # ── infoCompRetencion ─────────────────────────────────────────────────
        info_ret = etree.SubElement(ret_xml, 'infoCompRetencion')
        etree.SubElement(info_ret, 'fechaEmision').text     = timezone.localtime(comprobante.fecha_emision).strftime('%d/%m/%Y')
        etree.SubElement(info_ret, 'dirEstablecimiento').text = self.empresa.direccion_matriz

        if self.empresa.contribuyente_especial:
            etree.SubElement(info_ret, 'contribuyenteEspecial').text = self.empresa.contribuyente_especial

        etree.SubElement(info_ret, 'obligadoContabilidad').text        = 'SI' if self.empresa.obligado_contabilidad else 'NO'
        etree.SubElement(info_ret, 'tipoIdentificacionSujetoRetenido').text = sujeto.tipo_identificacion
        etree.SubElement(info_ret, 'razonSocialSujetoRetenido').text   = sujeto.razon_social
        etree.SubElement(info_ret, 'identificacionSujetoRetenido').text = sujeto.identificacion
        etree.SubElement(info_ret, 'periodoFiscal').text               = retencion.periodo_fiscal

        # ── impuestos ─────────────────────────────────────────────────────────
        impuestos_el = etree.SubElement(ret_xml, 'impuestos')
        for imp in retencion.impuestos.all():
            imp_el = etree.SubElement(impuestos_el, 'impuesto')
            etree.SubElement(imp_el, 'codigo').text                      = imp.codigo
            etree.SubElement(imp_el, 'codigoPorcentaje').text            = imp.codigo_porcentaje
            etree.SubElement(imp_el, 'tarifa').text                      = f"{imp.tarifa:.2f}"
            etree.SubElement(imp_el, 'baseImponible').text               = f"{imp.base_imponible:.2f}"
            etree.SubElement(imp_el, 'valorRetenido').text               = f"{imp.valor_retenido:.2f}"
            etree.SubElement(imp_el, 'codDocSustento').text              = imp.cod_doc_sustento
            etree.SubElement(imp_el, 'numDocSustento').text              = imp.num_doc_sustento
            etree.SubElement(imp_el, 'fechaEmisionDocSustento').text     = imp.fecha_emision_doc_sustento.strftime('%d/%m/%Y')

        # ── infoAdicional (email proveedor) ───────────────────────────────────
        campos: dict = {}
        if sujeto.email:
            campos['email'] = sujeto.email
        if sujeto.telefono:
            campos['telefono'] = sujeto.telefono
        if campos:
            info_adic = etree.SubElement(ret_xml, 'infoAdicional')
            for nombre, valor in campos.items():
                etree.SubElement(info_adic, 'campoAdicional', nombre=nombre).text = str(valor)

        xml_string = etree.tostring(
            ret_xml, pretty_print=False, xml_declaration=True, encoding='UTF-8',
        ).decode('utf-8')
        comprobante.xml_generado = xml_string
        comprobante.save(update_fields=['xml_generado'])
        return xml_string

    def generar_xml_nota_debito(self, nota_debito):
        """
        Genera el XML de una Nota de Débito Electrónica (codDoc=05) según el SRI.
        Referencia: Ficha Técnica SRI v2.x — Nota de Débito.
        """
        TIPO_ND = '05'
        comprobante     = nota_debito.comprobante
        cliente         = nota_debito.cliente
        factura_origen  = nota_debito.factura_origen

        if not comprobante.clave_acceso or comprobante.estado not in ('AUTORIZADO', 'ENVIADO'):
            serie = f"{comprobante.establecimiento}-{comprobante.punto_emision}"
            comprobante.clave_acceso = self.generar_clave_acceso(
                fecha_emision=comprobante.fecha_emision,
                tipo_comprobante=TIPO_ND,
                ruc=self.empresa.ruc,
                ambiente=self.ambiente,
                serie=serie,
                numero_comprobante=comprobante.secuencial,
                codigo_numerico=str(random.randint(10000000, 99999999)),
            )
            comprobante.save(update_fields=['clave_acceso'])

        nd_xml = etree.Element('notaDebito', id='comprobante', version='1.0.0')

        # ── infoTributaria ────────────────────────────────────────────────────
        info_trib = etree.SubElement(nd_xml, 'infoTributaria')
        etree.SubElement(info_trib, 'ambiente').text        = self.ambiente
        etree.SubElement(info_trib, 'tipoEmision').text     = '1'
        etree.SubElement(info_trib, 'razonSocial').text     = self.empresa.razon_social
        etree.SubElement(info_trib, 'nombreComercial').text = self.empresa.nombre_comercial or self.empresa.razon_social
        etree.SubElement(info_trib, 'ruc').text             = self.empresa.ruc
        etree.SubElement(info_trib, 'claveAcceso').text     = comprobante.clave_acceso
        etree.SubElement(info_trib, 'codDoc').text          = TIPO_ND
        etree.SubElement(info_trib, 'estab').text           = comprobante.establecimiento
        etree.SubElement(info_trib, 'ptoEmi').text          = comprobante.punto_emision
        etree.SubElement(info_trib, 'secuencial').text      = comprobante.secuencial
        etree.SubElement(info_trib, 'dirMatriz').text       = self.empresa.direccion_matriz

        # ── infoNotaDebito ────────────────────────────────────────────────────
        info_nd = etree.SubElement(nd_xml, 'infoNotaDebito')
        etree.SubElement(info_nd, 'fechaEmision').text = timezone.localtime(comprobante.fecha_emision).strftime('%d/%m/%Y')
        etree.SubElement(info_nd, 'dirEstablecimiento').text = self.empresa.direccion_matriz
        etree.SubElement(info_nd, 'tipoIdentificacionComprador').text = cliente.tipo_identificacion
        etree.SubElement(info_nd, 'razonSocialComprador').text        = cliente.razon_social
        etree.SubElement(info_nd, 'identificacionComprador').text     = cliente.identificacion

        if self.empresa.contribuyente_especial:
            etree.SubElement(info_nd, 'contribuyenteEspecial').text = self.empresa.contribuyente_especial

        etree.SubElement(info_nd, 'obligadoContabilidad').text = 'SI' if self.empresa.obligado_contabilidad else 'NO'
        etree.SubElement(info_nd, 'codDocModificado').text = '01'  # 01 = Factura
        num_doc = factura_origen.comprobante.numero_comprobante if factura_origen else '001-001-000000001'
        fecha_doc = (
            timezone.localtime(factura_origen.comprobante.fecha_emision).strftime('%d/%m/%Y')
            if factura_origen else timezone.localtime(comprobante.fecha_emision).strftime('%d/%m/%Y')
        )
        etree.SubElement(info_nd, 'numDocModificado').text         = num_doc
        etree.SubElement(info_nd, 'fechaEmisionDocSustento').text  = fecha_doc
        etree.SubElement(info_nd, 'totalSinImpuestos').text        = f"{nota_debito.subtotal_sin_impuestos:.2f}"
        etree.SubElement(info_nd, 'valorTotal').text               = f"{nota_debito.total:.2f}"

        # totalConImpuestos — agrupado por (codigo, codigoPorcentaje)
        from collections import defaultdict
        from decimal import Decimal as _D
        totals: dict = defaultdict(lambda: {'base': _D('0.00'), 'valor': _D('0.00')})
        for det in nota_debito.detalles.all():
            key = (det.codigo_impuesto, det.codigo_porcentaje, det.tarifa)
            totals[key]['base']  += det.valor
            totals[key]['valor'] += det.valor_impuesto
        total_con_imp = etree.SubElement(info_nd, 'totalConImpuestos')
        for (cod, cod_pct, _tarifa), vals in totals.items():
            ti = etree.SubElement(total_con_imp, 'totalImpuesto')
            etree.SubElement(ti, 'codigo').text           = cod
            etree.SubElement(ti, 'codigoPorcentaje').text = cod_pct
            etree.SubElement(ti, 'baseImponible').text    = f"{vals['base']:.2f}"
            etree.SubElement(ti, 'valor').text            = f"{vals['valor']:.2f}"

        # ── motivo ────────────────────────────────────────────────────────────
        etree.SubElement(info_nd, 'motivo').text = nota_debito.motivo

        # ── detalles (razones del débito) ─────────────────────────────────────
        motivos_el = etree.SubElement(nd_xml, 'motivos')
        for det in nota_debito.detalles.all():
            mot_el = etree.SubElement(motivos_el, 'motivo')
            etree.SubElement(mot_el, 'razon').text = det.razon
            etree.SubElement(mot_el, 'valor').text = f"{det.valor:.2f}"

        # ── infoAdicional ─────────────────────────────────────────────────────
        campos: dict = {}
        if cliente.email:
            campos['email'] = cliente.email
        if cliente.telefono:
            campos['telefono'] = cliente.telefono
        if campos:
            info_adic = etree.SubElement(nd_xml, 'infoAdicional')
            for nombre, valor in campos.items():
                etree.SubElement(info_adic, 'campoAdicional', nombre=nombre).text = str(valor)

        xml_string = etree.tostring(
            nd_xml, pretty_print=False, xml_declaration=True, encoding='UTF-8',
        ).decode('utf-8')
        comprobante.xml_generado = xml_string
        comprobante.save(update_fields=['xml_generado'])
        return xml_string

    def firmar_xml(self, xml_string):
        """
        Firma electrónicamente el XML con XAdES-BES según especificaciones SRI Ecuador.
        Ficha Técnica v2.x: 3 referencias (comprobante + KeyInfo + SignedProperties).
        C14N de SignedInfo se computa IN-TREE para que los namespaces coincidan
        exactamente con lo que verifica el SRI.
        """
        import base64, hashlib, datetime, warnings
        from cryptography.hazmat.primitives.serialization import pkcs12 as _pkcs12
        from cryptography.hazmat.primitives import hashes as _hashes
        from cryptography.hazmat.primitives import serialization as _serial
        from cryptography.hazmat.primitives.asymmetric import padding as _pad

        if not self.empresa.certificado_digital:
            raise ValueError("La empresa no tiene configurado un certificado digital")

        cert_path = self.empresa.certificado_digital.path
        with open(cert_path, 'rb') as f:
            cert_data = f.read()
        pwd = (self.empresa.password_certificado or '').encode('utf-8')
        private_key, certificate, _ = _pkcs12.load_key_and_certificates(cert_data, pwd)

        DS       = 'http://www.w3.org/2000/09/xmldsig#'
        XADES    = 'http://uri.etsi.org/01903/v1.3.2#'
        C14N     = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
        SHA1_URI = 'http://www.w3.org/2000/09/xmldsig#sha1'
        RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'

        # Abreviaciones estándar para DN attributes
        _OID_SHORT = {
            '2.5.4.3': 'CN', '2.5.4.4': 'SN', '2.5.4.5': 'serialNumber',
            '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST',
            '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.42': 'GN',
        }
        def _dn_forward(name_obj):
            """Orden X.509 forward (no RFC4514 invertido) con abreviaciones estándar."""
            parts = []
            for attr in name_obj:
                short = _OID_SHORT.get(attr.oid.dotted_string, attr.oid.dotted_string)
                parts.append(f'{short}={attr.value}')
            return ','.join(parts)

        def _c14n(elem):
            return etree.tostring(elem, method='c14n', exclusive=False, with_comments=False)

        def _sha1b64(data):
            return base64.b64encode(hashlib.sha1(data).digest()).decode()

        root = etree.fromstring(xml_string.encode('utf-8'))

        # ── PASO 1: Digest del comprobante ANTES de agregar la firma ─────────
        # Se usa enveloped-signature transform → SRI excluye el bloque Signature
        # al verificar, igual que nosotros aquí (root aún no tiene sig_el).
        comprobante_dv = _sha1b64(_c14n(root))

        # ── PASO 2: Datos del certificado ────────────────────────────────────
        cert_der = certificate.public_bytes(_serial.Encoding.DER)
        cert_b64 = base64.b64encode(cert_der).decode()
        cert_dv  = _sha1b64(cert_der)
        # Orden forward (no RFC4514 invertido) para que coincida con el certificado
        issuer_name   = _dn_forward(certificate.issuer)
        serial_number = str(certificate.serial_number)
        pub_nums = certificate.public_key().public_numbers()
        n_b64 = base64.b64encode(
            pub_nums.n.to_bytes((pub_nums.n.bit_length() + 7) // 8, 'big')).decode()
        e_b64 = base64.b64encode(
            pub_nums.e.to_bytes((pub_nums.e.bit_length() + 7) // 8, 'big')).decode()

        # ── PASO 3: Construir estructura completa con placeholders ───────────
        tz      = datetime.timezone(datetime.timedelta(hours=-5))
        now_str = datetime.datetime.now(tz).strftime('%Y-%m-%dT%H:%M:%S.000-05:00')

        # ds:Signature declara SOLO ds → xades no contamina el C14N de SignedInfo/KeyInfo
        sig_el = etree.Element(f'{{{DS}}}Signature', Id='Signature',
                               nsmap={'ds': DS})

        # ds:SignedInfo (SubElement: hereda nsmap del padre)
        si = etree.SubElement(sig_el, f'{{{DS}}}SignedInfo')
        etree.SubElement(si, f'{{{DS}}}CanonicalizationMethod', Algorithm=C14N)
        etree.SubElement(si, f'{{{DS}}}SignatureMethod', Algorithm=RSA_SHA1)

        r1 = etree.SubElement(si, f'{{{DS}}}Reference', URI='#comprobante')
        t1 = etree.SubElement(r1, f'{{{DS}}}Transforms')
        # enveloped-signature excluye el bloque Signature al verificar el digest
        etree.SubElement(t1, f'{{{DS}}}Transform', Algorithm=ENVELOPED)
        etree.SubElement(t1, f'{{{DS}}}Transform', Algorithm=C14N)
        etree.SubElement(r1, f'{{{DS}}}DigestMethod', Algorithm=SHA1_URI)
        dv1 = etree.SubElement(r1, f'{{{DS}}}DigestValue')
        dv1.text = comprobante_dv  # ya conocido

        r2 = etree.SubElement(si, f'{{{DS}}}Reference', URI='#Certificate1')
        etree.SubElement(r2, f'{{{DS}}}DigestMethod', Algorithm=SHA1_URI)
        dv2 = etree.SubElement(r2, f'{{{DS}}}DigestValue')
        dv2.text = 'PLACEHOLDER'

        r3 = etree.SubElement(si, f'{{{DS}}}Reference',
                               Type='http://uri.etsi.org/01903#SignedProperties',
                               URI='#Signature-SignedProperties')
        t3 = etree.SubElement(r3, f'{{{DS}}}Transforms')
        etree.SubElement(t3, f'{{{DS}}}Transform', Algorithm=C14N)
        etree.SubElement(r3, f'{{{DS}}}DigestMethod', Algorithm=SHA1_URI)
        dv3 = etree.SubElement(r3, f'{{{DS}}}DigestValue')
        dv3.text = 'PLACEHOLDER'

        sv_el = etree.SubElement(sig_el, f'{{{DS}}}SignatureValue', Id='SignatureValue')
        sv_el.text = ''

        ki = etree.SubElement(sig_el, f'{{{DS}}}KeyInfo', Id='Certificate1')
        x509d = etree.SubElement(ki, f'{{{DS}}}X509Data')
        etree.SubElement(x509d, f'{{{DS}}}X509Certificate').text = cert_b64
        kv    = etree.SubElement(ki, f'{{{DS}}}KeyValue')
        rsa_kv = etree.SubElement(kv, f'{{{DS}}}RSAKeyValue')
        etree.SubElement(rsa_kv, f'{{{DS}}}Modulus').text  = n_b64
        etree.SubElement(rsa_kv, f'{{{DS}}}Exponent').text = e_b64

        obj_el = etree.SubElement(sig_el, f'{{{DS}}}Object', Id='QualifyingProperties')
        # xades se declara aquí (bajo Object), NO en Signature → no contamina SignedInfo
        qp_el  = etree.SubElement(obj_el, f'{{{XADES}}}QualifyingProperties',
                                  Target='#Signature',
                                  nsmap={'xades': XADES})
        sp = etree.SubElement(qp_el, f'{{{XADES}}}SignedProperties',
                              Id='Signature-SignedProperties')
        ssp = etree.SubElement(sp, f'{{{XADES}}}SignedSignatureProperties')
        etree.SubElement(ssp, f'{{{XADES}}}SigningTime').text = now_str
        sc  = etree.SubElement(ssp, f'{{{XADES}}}SigningCertificate')
        c_e = etree.SubElement(sc,  f'{{{XADES}}}Cert')
        cd  = etree.SubElement(c_e, f'{{{XADES}}}CertDigest')
        etree.SubElement(cd, f'{{{DS}}}DigestMethod', Algorithm=SHA1_URI)
        etree.SubElement(cd, f'{{{DS}}}DigestValue').text = cert_dv
        is_ = etree.SubElement(c_e, f'{{{XADES}}}IssuerSerial')
        etree.SubElement(is_, f'{{{DS}}}X509IssuerName').text   = issuer_name
        etree.SubElement(is_, f'{{{DS}}}X509SerialNumber').text = serial_number

        # ── PASO 4: Adjuntar al root ─────────────────────────────────────────
        root.append(sig_el)

        # ── PASO 5: Calcular digests IN-TREE (namespaces correctos) ──────────
        dv2.text = _sha1b64(_c14n(ki))
        dv3.text = _sha1b64(_c14n(sp))

        # ── PASO 6: Firmar SignedInfo IN-TREE ────────────────────────────────
        # si está dentro de sig_el que tiene ds+xades → el C14N de si incluye
        # ambos namespaces, igual que lo que verificará el SRI.
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            sig_bytes = private_key.sign(_c14n(si), _pad.PKCS1v15(), _hashes.SHA1())
        sv_el.text = base64.b64encode(sig_bytes).decode()

        # Sin pretty_print: el whitespace entre elementos invalida los digests SHA1
        return etree.tostring(
            root,
            pretty_print=False,
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
            
            # Enviar comprobante (SRI espera Base64Binary → pasar bytes)
            response = client.service.validarComprobante(comprobante.xml_firmado.encode('utf-8'))
            
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
