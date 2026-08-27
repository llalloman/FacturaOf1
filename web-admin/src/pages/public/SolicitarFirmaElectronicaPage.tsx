import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  FileUp,
  Landmark,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  firmasService,
  type CuponFirmaQuote,
  type DocumentoPublicoFirma,
  type PayPhoneFirmaPaymentResponse,
  type PrecioFirma,
  type PublicFinalizeResponse,
  type PublicSignatureLookupResponse,
  type SolicitudFirmaPublicPayload,
  type TipoSolicitudFirma,
  type VigenciaFirma,
} from '../../services/firmasService';


declare global {
  interface Window {
    PPaymentButtonBox?: new (config: Record<string, unknown>) => { render: (containerId: string) => void };
  }
}

const payphoneScriptUrl = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js';
const payphoneCssUrl = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css';
let payphoneAssetsPromise: Promise<void> | null = null;

const loadPayPhoneAssets = () => {
  if (window.PPaymentButtonBox) return Promise.resolve();
  if (payphoneAssetsPromise) return payphoneAssetsPromise;
  payphoneAssetsPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${payphoneCssUrl}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = payphoneCssUrl;
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${payphoneScriptUrl}"]`);
    const waitForSdk = () => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.PPaymentButtonBox) {
          window.clearInterval(timer);
          resolve();
        } else if (attempts > 80) {
          window.clearInterval(timer);
          reject(new Error('No se pudo cargar la cajita de pagos PayPhone.'));
        }
      }, 100);
    };
    if (existing) {
      waitForSdk();
      return;
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = payphoneScriptUrl;
    script.onload = waitForSdk;
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de PayPhone.'));
    document.head.appendChild(script);
  });
  return payphoneAssetsPromise;
};

const whatsappBase = 'https://api.whatsapp.com/send/';
const signatureTermsVersion = 'terminos-2026-08-24';
const signaturePrivacyVersion = 'privacidad-2026-08-24';
const maxDocumentSizeBytes = 15 * 1024 * 1024;
const maxDocumentSizeMb = maxDocumentSizeBytes / 1024 / 1024;
const allowedDocumentExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
const allowedDocumentMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const paymentAccounts = [
  {
    bank: 'Produbanco',
    accountType: 'Cuenta de Ahorros',
    accountNumber: '12005608916',
    holder: 'Walter Gerardo Molina',
    identification: 'CI: 1721085213',
  },
  {
    bank: 'Banco Pichincha',
    accountType: 'Cuenta de Ahorro Transaccional',
    accountNumber: '2212779087',
    holder: 'Walter Gerardo Molina',
  },
  {
    bank: 'Banco Guayaquil',
    accountType: 'Cuenta de Ahorros',
    accountNumber: '0054069558',
    holder: 'Walter Gerardo Molina',
    identification: 'CI: 1721085213',
  },
];

const baseForm: SolicitudFirmaPublicPayload = {
  request_type: 'PERSONA_NATURAL',
  identification_type: 'CEDULA',
  first_name: '',
  last_name: '',
  second_last_name: '',
  identification: '',
  fingerprint_code: '',
  birth_date: '',
  nationality: 'ECUATORIANA',
  gender: '',
  has_ruc: false,
  ruc: '',
  business_name: '',
  company_unit: '',
  applicant_position: '',
  request_reason: '',
  email: '',
  secondary_email: '',
  phone: '',
  secondary_phone: '',
  province: '',
  city: '',
  parish: '',
  address: '',
  representative_identification_type: 'CEDULA',
  representative_identification: '',
  representative_names: '',
  representative_last_names: '',
  validity: '1_ANIO',
  container_type: 'ARCHIVO',
  wants_erp: false,
  interested_plan: 'SOLO_FIRMA',
  coupon_code: '',
  accepted_terms: false,
  accepted_privacy: false,
  terms_version: signatureTermsVersion,
  privacy_version: signaturePrivacyVersion,
  archivos: {},
};

const steps = ['Datos personales', 'Documentos', 'Resumen', 'Confirmación'];

const fallbackPreciosFirma: PrecioFirma[] = [
  { id: 0, validity: '7_DIAS', validity_display: '7 días', regular_price: '8.00', current_price: '8.00', active: true, order: 1 },
  { id: 0, validity: '15_DIAS', validity_display: '15 días', regular_price: '8.00', current_price: '8.00', active: true, order: 2 },
  { id: 0, validity: '1_MES', validity_display: '30 días', regular_price: '9.00', current_price: '9.00', active: true, order: 3 },
  { id: 0, validity: '1_ANIO', validity_display: '1 año', regular_price: '21.00', current_price: '21.00', active: true, order: 4 },
  { id: 0, validity: '2_ANIOS', validity_display: '2 años', regular_price: '32.00', current_price: '32.00', active: true, order: 5 },
  { id: 0, validity: '3_ANIOS', validity_display: '3 años', regular_price: '43.00', current_price: '43.00', active: true, order: 6 },
  { id: 0, validity: '4_ANIOS', validity_display: '4 años', regular_price: '53.00', current_price: '53.00', active: true, order: 7 },
  { id: 0, validity: '5_ANIOS', validity_display: '5 años', regular_price: '62.00', current_price: '62.00', active: true, order: 8 },
];

const money = (value?: string | number) => `$${Number(value ?? 0).toFixed(2)}`;
const paidPaymentStatuses = new Set(['PAID', 'APPROVED', 'PAGADO']);
const isPaymentPaid = (status?: string | null) => paidPaymentStatuses.has(String(status ?? '').toUpperCase());
const paymentStatusLabel = (payment?: PublicSignatureLookupResponse['payment']) => {
  if (!payment) return 'Pendiente de pago';
  if (isPaymentPaid(payment.status)) return payment.status_display || 'Pagado';
  return payment.status_display || payment.status || 'Pendiente de pago';
};
const paymentMethodLabel = (payment?: PublicSignatureLookupResponse['payment']) => {
  if (!payment) return 'Pendiente';
  return payment.payment_method_display || payment.provider_display || payment.provider || 'PayPhone / tarjeta';
};
const fileSizeMb = (file: File) => (file.size / 1024 / 1024).toFixed(2);
const getFileExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';
const isAllowedDocumentFile = (file: File) => {
  const extension = getFileExtension(file.name);
  return allowedDocumentExtensions.includes(extension) && (!file.type || allowedDocumentMimeTypes.includes(file.type));
};

const tipoLabels: Record<TipoSolicitudFirma, string> = {
  PERSONA_NATURAL: 'Persona Natural',
  MIEMBRO_EMPRESA: 'Miembro de Empresa',
  REPRESENTANTE_LEGAL: 'Representante Legal',
};

const tipoDescriptions: Record<TipoSolicitudFirma, string> = {
  PERSONA_NATURAL: 'Para cédula, RUC personal o actividad independiente.',
  MIEMBRO_EMPRESA: 'Para colaboradores autorizados dentro de una empresa.',
  REPRESENTANTE_LEGAL: 'Para representantes legales de compañías.',
};

const buildNaturalRuc = (identification?: string) => {
  const digits = (identification ?? '').replace(/\D/g, '');
  return digits.length === 10 ? `${digits}001` : '';
};

const ecuadorLocations: Record<string, string[]> = {
  AZUAY: ['CUENCA', 'GIRON', 'GUALACEO', 'NABON', 'PAUTE', 'PUCARA', 'SAN FERNANDO', 'SANTA ISABEL', 'SIGSIG', 'OÑA', 'CHORDELEG', 'EL PAN', 'SEVILLA DE ORO', 'GUACHAPALA', 'CAMILO PONCE ENRIQUEZ'],
  BOLIVAR: ['GUARANDA', 'CHILLANES', 'CHIMBO', 'ECHEANDIA', 'SAN MIGUEL', 'CALUMA', 'LAS NAVES'],
  CAÑAR: ['AZOGUES', 'BIBLIAN', 'CAÑAR', 'LA TRONCAL', 'EL TAMBO', 'DELEG', 'SUSCAL'],
  CARCHI: ['TULCAN', 'BOLIVAR', 'ESPEJO', 'MIRA', 'MONTUFAR', 'SAN PEDRO DE HUACA'],
  CHIMBORAZO: ['RIOBAMBA', 'ALAUSI', 'COLTA', 'CHAMBO', 'CHUNCHI', 'GUAMOTE', 'GUANO', 'PALLATANGA', 'PENIPE', 'CUMANDA'],
  COTOPAXI: ['LATACUNGA', 'LA MANA', 'PANGUA', 'PUJILI', 'SALCEDO', 'SAQUISILI', 'SIGCHOS'],
  'EL ORO': ['MACHALA', 'ARENILLAS', 'ATAHUALPA', 'BALSAS', 'CHILLA', 'EL GUABO', 'HUAQUILLAS', 'MARCABELI', 'PASAJE', 'PIÑAS', 'PORTOVELO', 'SANTA ROSA', 'ZARUMA', 'LAS LAJAS'],
  ESMERALDAS: ['ESMERALDAS', 'ELOY ALFARO', 'MUISNE', 'QUININDE', 'SAN LORENZO', 'ATACAMES', 'RIOVERDE', 'LA CONCORDIA'],
  GALAPAGOS: ['SAN CRISTOBAL', 'ISABELA', 'SANTA CRUZ'],
  GUAYAS: ['GUAYAQUIL', 'ALFREDO BAQUERIZO MORENO', 'BALAO', 'BALZAR', 'COLIMES', 'DAULE', 'DURAN', 'EL EMPALME', 'EL TRIUNFO', 'MILAGRO', 'NARANJAL', 'NARANJITO', 'PALESTINA', 'PEDRO CARBO', 'SAMBORONDON', 'SANTA LUCIA', 'SALITRE', 'SAN JACINTO DE YAGUACHI', 'PLAYAS', 'SIMON BOLIVAR', 'CORONEL MARCELINO MARIDUEÑA', 'LOMAS DE SARGENTILLO', 'NOBOL', 'GENERAL ANTONIO ELIZALDE', 'ISIDRO AYORA'],
  IMBABURA: ['IBARRA', 'ANTONIO ANTE', 'COTACACHI', 'OTAVALO', 'PIMAMPIRO', 'SAN MIGUEL DE URCUQUI'],
  LOJA: ['LOJA', 'CALVAS', 'CATAMAYO', 'CELICA', 'CHAGUARPAMBA', 'ESPINDOLA', 'GONZANAMA', 'MACARA', 'PALTAS', 'PUYANGO', 'SARAGURO', 'SOZORANGA', 'ZAPOTILLO', 'PINDAL', 'QUILANGA', 'OLMEDO'],
  'LOS RIOS': ['BABAHOYO', 'BABA', 'MONTALVO', 'PUEBLOVIEJO', 'QUEVEDO', 'URDANETA', 'VENTANAS', 'VINCES', 'PALENQUE', 'BUENA FE', 'VALENCIA', 'MOCACHE', 'QUINSALOMA'],
  MANABI: ['PORTOVIEJO', 'BOLIVAR', 'CHONE', 'EL CARMEN', 'FLAVIO ALFARO', 'JIPIJAPA', 'JUNIN', 'MANTA', 'MONTECRISTI', 'PAJAN', 'PICHINCHA', 'ROCAFUERTE', 'SANTA ANA', 'SUCRE', 'TOSAGUA', '24 DE MAYO', 'PEDERNALES', 'OLMEDO', 'PUERTO LOPEZ', 'JAMA', 'JARAMIJO', 'SAN VICENTE'],
  'MORONA SANTIAGO': ['MORONA', 'GUALAQUIZA', 'LIMON INDANZA', 'PALORA', 'SANTIAGO', 'SUCUA', 'HUAMBOYA', 'SAN JUAN BOSCO', 'TAISHA', 'LOGROÑO', 'PABLO SEXTO', 'TIWINTZA'],
  NAPO: ['TENA', 'ARCHIDONA', 'EL CHACO', 'QUIJOS', 'CARLOS JULIO AROSEMENA TOLA'],
  ORELLANA: ['ORELLANA', 'AGUARICO', 'LA JOYA DE LOS SACHAS', 'LORETO'],
  PASTAZA: ['PASTAZA', 'MERA', 'SANTA CLARA', 'ARAJUNO'],
  PICHINCHA: ['QUITO', 'CAYAMBE', 'MEJIA', 'PEDRO MONCAYO', 'RUMIÑAHUI', 'SAN MIGUEL DE LOS BANCOS', 'PEDRO VICENTE MALDONADO', 'PUERTO QUITO'],
  'SANTA ELENA': ['SANTA ELENA', 'LA LIBERTAD', 'SALINAS'],
  'SANTO DOMINGO DE LOS TSACHILAS': ['SANTO DOMINGO', 'LA CONCORDIA'],
  SUCUMBIOS: ['LAGO AGRIO', 'GONZALO PIZARRO', 'PUTUMAYO', 'SHUSHUFINDI', 'SUCUMBIOS', 'CASCALES', 'CUYABENO'],
  TUNGURAHUA: ['AMBATO', 'BAÑOS DE AGUA SANTA', 'CEVALLOS', 'MOCHA', 'PATATE', 'QUERO', 'SAN PEDRO DE PELILEO', 'SANTIAGO DE PILLARO', 'TISALEO'],
  'ZAMORA CHINCHIPE': ['ZAMORA', 'CHINCHIPE', 'NANGARITZA', 'YACUAMBI', 'YANTZAZA', 'EL PANGUI', 'CENTINELA DEL CONDOR', 'PALANDA', 'PAQUISHA'],
};
const provinceOptions = Object.keys(ecuadorLocations);
const normalizeUpper = (value: unknown) => typeof value === 'string' ? value.toUpperCase() : value;
const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');
const isIdentificationField = (field: keyof SolicitudFirmaPublicPayload) => ['identification', 'ruc', 'representative_identification'].includes(String(field));
const isPhoneField = (field: keyof SolicitudFirmaPublicPayload) => ['phone', 'secondary_phone'].includes(String(field));
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase text-slate-500';
const fieldInputClass = (invalid?: boolean) => `${inputClass} ${invalid ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' : ''}`;

type DocumentConfig = {
  key: DocumentoPublicoFirma;
  label: string;
  helper: string;
  required?: boolean;
};

const naturalDocs: DocumentConfig[] = [
  { key: 'cedula_anverso', label: 'Cédula frontal', helper: 'Foto del lado frontal. JPG o PNG.', required: true },
  { key: 'cedula_reverso', label: 'Cédula posterior', helper: 'Foto del lado posterior. JPG o PNG.', required: true },
  { key: 'selfie_cedula', label: 'Selfie', helper: 'Foto selfie con la cédula. JPG o PNG.', required: true },
  { key: 'documento_adicional', label: 'Documento adicional', helper: 'PDF, JPG o PNG.', required: false },
];

const companyDocs: DocumentConfig[] = [
  { key: 'cedula_anverso', label: 'Cédula frontal', helper: 'Foto del lado frontal. JPG o PNG.', required: true },
  { key: 'cedula_reverso', label: 'Cédula posterior', helper: 'Foto del lado posterior. JPG o PNG.', required: true },
  { key: 'selfie_cedula', label: 'Selfie', helper: 'Foto selfie con la cédula. JPG o PNG.', required: true },
  { key: 'ruc_pdf', label: 'RUC', helper: 'Archivo PDF del certificado del RUC.', required: true },
  { key: 'constitucion_compania', label: 'Constitución de compañía', helper: 'Archivo PDF de la constitución.', required: true },
  { key: 'nombramiento_representante', label: 'Nombramiento', helper: 'PDF del nombramiento legalizado.', required: true },
  { key: 'aceptacion_nombramiento', label: 'Aceptación de nombramiento', helper: 'PDF de aceptación si no consta en el nombramiento.', required: false },
  { key: 'carta_autorizacion', label: 'Autorización', helper: 'PDF de autorización del representante legal.', required: true },
  { key: 'cedula_representante', label: 'Identificación del representante legal', helper: 'PDF con ambos lados del documento.', required: true },
  { key: 'documento_adicional', label: 'Documento adicional', helper: 'PDF, JPG o PNG.', required: false },
];

const legalDocs: DocumentConfig[] = [
  { key: 'cedula_anverso', label: 'Cédula frontal', helper: 'Foto del lado frontal. JPG o PNG.', required: true },
  { key: 'cedula_reverso', label: 'Cédula posterior', helper: 'Foto del lado posterior. JPG o PNG.', required: true },
  { key: 'selfie_cedula', label: 'Selfie', helper: 'Foto selfie con la cédula. JPG o PNG.', required: true },
  { key: 'ruc_pdf', label: 'RUC', helper: 'Archivo PDF del certificado del RUC.', required: true },
  { key: 'constitucion_compania', label: 'Constitución de compañía', helper: 'Archivo PDF de la constitución.', required: true },
  { key: 'nombramiento_representante', label: 'Nombramiento', helper: 'PDF del nombramiento legalizado.', required: true },
  { key: 'aceptacion_nombramiento', label: 'Aceptación de nombramiento', helper: 'PDF de aceptación si aplica.', required: false },
  { key: 'documento_adicional', label: 'Documento adicional', helper: 'PDF, JPG o PNG.', required: false },
];

function Field({ label, children, invalid }: { label: string; children: ReactNode; invalid?: boolean }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {invalid && <span className="mt-1 block text-xs font-semibold text-red-600">Campo obligatorio</span>}
    </label>
  );
}

export default function SolicitarFirmaElectronicaPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<SolicitudFirmaPublicPayload>(baseForm);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [couponInput, setCouponInput] = useState('');
  const [couponQuote, setCouponQuote] = useState<CuponFirmaQuote | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [payphoneLoading, setPayphoneLoading] = useState(false);
  const [payphoneModalOpen, setPayphoneModalOpen] = useState(false);
  const [payphonePayment, setPayphonePayment] = useState<PayPhoneFirmaPaymentResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupForm, setLookupForm] = useState({ requestNumber: '', verification: '' });
  const [recoveredLookup, setRecoveredLookup] = useState<PublicSignatureLookupResponse | null>(null);
  const [confirmed, setConfirmed] = useState<{
    id: number;
    requestNumber: string;
    message: string;
    emailStatus?: PublicFinalizeResponse['email_status'];
  } | null>(null);

  const applyRecoveredLookup = (result: PublicSignatureLookupResponse, fallbackRequestNumber?: string) => {
    const solicitud = result.solicitud;
    setRecoveredLookup(result);
    setForm((prev) => ({
      ...prev,
      request_type: solicitud.request_type,
      identification_type: solicitud.identification_type,
      first_name: solicitud.first_name,
      last_name: solicitud.last_name,
      second_last_name: solicitud.second_last_name ?? '',
      identification: solicitud.identification,
      fingerprint_code: solicitud.fingerprint_code ?? '',
      birth_date: solicitud.birth_date ?? '',
      nationality: solicitud.nationality ?? 'ECUATORIANA',
      gender: solicitud.gender ?? '',
      has_ruc: Boolean(solicitud.has_ruc),
      ruc: solicitud.ruc ?? '',
      business_name: solicitud.business_name ?? '',
      company_unit: solicitud.company_unit ?? '',
      applicant_position: solicitud.applicant_position ?? '',
      request_reason: solicitud.request_reason ?? '',
      email: solicitud.email,
      secondary_email: solicitud.secondary_email ?? '',
      phone: solicitud.phone,
      secondary_phone: solicitud.secondary_phone ?? '',
      province: solicitud.province,
      city: solicitud.city,
      parish: solicitud.parish ?? '',
      address: solicitud.address,
      representative_identification_type: solicitud.representative_identification_type ?? 'CEDULA',
      representative_identification: solicitud.representative_identification ?? '',
      representative_names: solicitud.representative_names ?? '',
      representative_last_names: solicitud.representative_last_names ?? '',
      validity: solicitud.validity,
      container_type: solicitud.container_type ?? 'ARCHIVO',
      wants_erp: Boolean(solicitud.wants_erp),
      interested_plan: solicitud.interested_plan,
      coupon_code: '',
      accepted_terms: true,
      accepted_privacy: true,
      archivos: {},
    }));
    setConfirmed({
      id: Number(solicitud.id),
      requestNumber: solicitud.request_number ?? fallbackRequestNumber ?? '',
      message: 'Esta solicitud ya fue registrada. Puedes revisar la información, ver los datos de transferencia o reintentar el pago con tarjeta.',
    });
    setStep(3);
  };

  const loadPublicSignature = async (params: { requestNumber: string; transaction?: string; verification?: string }) => {
    const requestNumber = params.requestNumber.trim();
    const transaction = params.transaction?.trim();
    const verification = params.verification?.trim();
    if (!requestNumber || (!transaction && !verification)) {
      setError('Ingresa el número de solicitud y la cédula, correo o teléfono registrado.');
      return;
    }
    setLookupLoading(true);
    setError('');
    try {
      const result = await firmasService.getPublicPaymentRequest({ requestNumber, transaction, verification });
      applyRecoveredLookup(result, requestNumber);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'No pudimos recuperar la solicitud. Revisa los datos ingresados o contáctanos por WhatsApp.');
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    const requestNumber = searchParams.get('request');
    const transaction = searchParams.get('transaction');
    if (!requestNumber || !transaction || confirmed) return;
    void loadPublicSignature({ requestNumber, transaction });
  }, [searchParams, confirmed]);

  const { data: preciosRemotos = [] } = useQuery({
    queryKey: ['precios-firma-publicos'],
    queryFn: firmasService.listPreciosFirmaPublicos,
  });
  const preciosFirma = preciosRemotos.length ? preciosRemotos : fallbackPreciosFirma;
  const precioSeleccionado = useMemo(
    () => preciosFirma.find((item) => item.validity === form.validity) ?? fallbackPreciosFirma.find((item) => item.validity === form.validity),
    [form.validity, preciosFirma],
  );
  const tienePromocion = Boolean(precioSeleccionado?.active_promotion && Number(precioSeleccionado.current_price) < Number(precioSeleccionado.regular_price));
  const totalMostrado = couponQuote?.final_price ?? precioSeleccionado?.current_price;
  const tieneDescuento = Number(totalMostrado ?? 0) < Number(precioSeleccionado?.regular_price ?? 0);

  const isCompanyRequest = form.request_type === 'MIEMBRO_EMPRESA' || form.request_type === 'REPRESENTANTE_LEGAL';
  const isMemberRequest = form.request_type === 'MIEMBRO_EMPRESA';
  const cantonesDisponibles = form.province ? (ecuadorLocations[form.province] ?? []) : [];
  const invalid = (field: keyof SolicitudFirmaPublicPayload) => invalidFields.has(String(field));
  const documentConfig = useMemo(() => {
    if (form.request_type === 'MIEMBRO_EMPRESA') return companyDocs;
    if (form.request_type === 'REPRESENTANTE_LEGAL') return legalDocs;
    return naturalDocs;
  }, [form.request_type]);
  const uploadedDocs = Object.values(form.archivos ?? {}).filter(Boolean).length;
  const requiredDocs = documentConfig.filter((doc) => doc.required).length;
  const uploadedRequiredDocs = documentConfig.filter((doc) => doc.required && form.archivos?.[doc.key]).length;

  const setField = (field: keyof SolicitudFirmaPublicPayload, value: unknown) => {
    setInvalidFields((current) => {
      if (!current.has(String(field))) return current;
      const nextInvalid = new Set(current);
      nextInvalid.delete(String(field));
      return nextInvalid;
    });
    setForm((prev) => {
      let normalized = normalizeUpper(value);
      if (isIdentificationField(field) || isPhoneField(field)) normalized = onlyDigits(value);
      const next = { ...prev, [field]: normalized };
      if (field === 'request_type') {
        next.archivos = {};
        next.has_ruc = value !== 'PERSONA_NATURAL';
        next.ruc = value === 'PERSONA_NATURAL' ? '' : next.ruc;
        next.identification_type = value === 'PERSONA_NATURAL' && next.identification_type === 'RUC' ? 'CEDULA' : next.identification_type;
        next.business_name = value === 'PERSONA_NATURAL' ? '' : next.business_name;
        next.company_unit = value === 'PERSONA_NATURAL' ? '' : next.company_unit;
        next.applicant_position = value === 'PERSONA_NATURAL' ? '' : next.applicant_position;
        next.request_reason = value === 'PERSONA_NATURAL' ? '' : next.request_reason;
      }
      if (field === 'identification' && next.request_type === 'PERSONA_NATURAL' && next.has_ruc) {
        next.ruc = buildNaturalRuc(String(normalized));
      }
      if (field === 'has_ruc' && next.request_type === 'PERSONA_NATURAL') {
        next.ruc = value ? buildNaturalRuc(next.identification) : '';
        next.business_name = '';
        next.company_unit = '';
        next.applicant_position = '';
        next.request_reason = '';
      }
      if (field === 'identification_type' && normalized !== 'PASAPORTE' && next.gender === 'OTRO') {
        next.gender = '';
      }
      if (field === 'province') {
        next.city = '';
        next.parish = '';
      }
      if (field === 'city') {
        next.parish = '';
      }
      return next;
    });
  };

  const setFile = (key: DocumentoPublicoFirma, file: File | null) => {
    setError('');
    if (file && !isAllowedDocumentFile(file)) {
      setError(`El archivo "${file.name}" no tiene un formato permitido. Sube un PDF, JPG o PNG.`);
      return;
    }
    if (file && file.size > maxDocumentSizeBytes) {
      setError(`El archivo "${file.name}" pesa ${fileSizeMb(file)} MB. El máximo permitido es ${maxDocumentSizeMb} MB por archivo.`);
      return;
    }
    setForm((prev) => ({
      ...prev,
      archivos: { ...(prev.archivos ?? {}), [key]: file },
    }));
  };

  const changeValidity = (validity: string) => {
    setField('validity', validity);
    setCouponInput('');
    setCouponQuote(null);
    setCouponMessage('');
    setField('coupon_code', '');
  };

  const applyCoupon = async () => {
    if (!couponInput.trim() || !form.validity) return;
    setCouponLoading(true);
    setCouponMessage('');
    try {
      const quote = await firmasService.validateCuponFirma({
        code: couponInput,
        validity: form.validity,
        identification: form.identification,
        email: form.email,
        phone: form.phone,
      });
      setCouponQuote(quote);
      setCouponInput(quote.code);
      setField('coupon_code', quote.applied ? quote.code : '');
      setCouponMessage(quote.message);
    } catch (err) {
      const data = (err as { response?: { data?: { coupon_code?: string[] | string } } })?.response?.data;
      const detail = Array.isArray(data?.coupon_code) ? data.coupon_code[0] : data?.coupon_code;
      setCouponQuote(null);
      setField('coupon_code', '');
      setCouponMessage(detail || 'El cupón no es válido para esta vigencia.');
    } finally {
      setCouponLoading(false);
    }
  };

  const validateStep = () => {
    setError('');
    setInvalidFields(new Set());
    if (step === 0) {
      const requiredFields: Array<keyof SolicitudFirmaPublicPayload> = [
        'identification_type', 'first_name', 'last_name', 'identification',
        'fingerprint_code', 'birth_date', 'nationality', 'gender',
        'email', 'phone', 'province', 'city', 'parish', 'address',
      ];
      if (isCompanyRequest) requiredFields.push('ruc', 'business_name', 'applicant_position');
      if (form.request_type === 'PERSONA_NATURAL' && form.has_ruc) requiredFields.push('ruc');
      if (isMemberRequest) {
        requiredFields.push(
          'company_unit',
          'request_reason',
          'representative_identification_type',
          'representative_identification',
          'representative_names',
          'representative_last_names',
        );
      }
      const missing = requiredFields.filter((field) => !form[field]);
      if (missing.length) {
        setInvalidFields(new Set(missing.map(String)));
        setError('Completa los campos obligatorios marcados en rojo para continuar.');
        return false;
      }
    }
    if (step === 1) {
      const missing = documentConfig.filter((doc) => doc.required && !form.archivos?.[doc.key]);
      if (missing.length) {
        setError(`Falta cargar: ${missing.map((item) => item.label).join(', ')}.`);
        return false;
      }
      const invalidFile = Object.values(form.archivos ?? {}).find((file) => file && (!isAllowedDocumentFile(file) || file.size > maxDocumentSizeBytes));
      if (invalidFile) {
        setError(`Revisa el archivo "${invalidFile.name}". Solo se permiten PDF, JPG o PNG de máximo ${maxDocumentSizeMb} MB.`);
        return false;
      }
    }
    if (step === 3 && (!form.accepted_terms || !form.accepted_privacy)) {
      setError('Debes aceptar los Términos y Condiciones y autorizar el tratamiento de datos personales para confirmar.');
      return false;
    }
    return true;
  };

  const next = () => {
    if (validateStep()) setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const previous = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  };


  const payWithPayPhone = async () => {
    if (!confirmed) return;
    setPayphoneLoading(true);
    setError('');
    try {
      const payment = await firmasService.createPayPhoneFirmaBoxPayment(confirmed.id, confirmed.requestNumber);
      if (!payment.box_config) {
        setError('PayPhone no devolvió la configuración de la cajita. Intenta nuevamente o contáctanos por WhatsApp.');
        return;
      }
      setPayphonePayment(payment);
      setPayphoneModalOpen(true);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'No se pudo abrir el pago con tarjeta. Intenta nuevamente o contáctanos por WhatsApp.');
    } finally {
      setPayphoneLoading(false);
    }
  };

  const confirmRequest = async () => {
    if (!validateStep()) return;
    const oversizedFile = Object.values(form.archivos ?? {}).find((file) => file && file.size > maxDocumentSizeBytes);
    if (oversizedFile) {
      setError(`El archivo "${oversizedFile.name}" pesa ${fileSizeMb(oversizedFile)} MB. El máximo permitido es ${maxDocumentSizeMb} MB por archivo.`);
      return;
    }
    setLoading(true);
    setError('');
    setInvalidFields(new Set());
    setUploadProgress('Registrando solicitud...');
    try {
      const result = await firmasService.createPublic(form);
      const filesToUpload = Object.entries(form.archivos ?? {}).filter((entry): entry is [DocumentoPublicoFirma, File] => Boolean(entry[1]));
      for (let index = 0; index < filesToUpload.length; index += 1) {
        const [documentKey, file] = filesToUpload[index];
        setUploadProgress(`Subiendo documento ${index + 1} de ${filesToUpload.length}: ${file.name}`);
        await firmasService.uploadPublicDocument(result.id, result.request_number, documentKey, file);
      }
      setUploadProgress('Finalizando solicitud...');
      const finalized = await firmasService.finalizePublic(result.id, result.request_number);
      setConfirmed({
        id: finalized.id,
        requestNumber: finalized.request_number,
        message: finalized.mensaje,
        emailStatus: finalized.email_status,
      });
      setStep(3);
    } catch (err) {
      const response = (err as { response?: { data?: unknown; status?: number } })?.response;
      const data = response?.data;
      if (response?.status === 413) {
        setError(`El archivo supera el límite permitido por el servidor. Comprime el archivo y vuelve a intentarlo. Máximo ${maxDocumentSizeMb} MB por archivo.`);
      } else {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setInvalidFields(new Set(Object.keys(data)));
        }
        setError(data ? JSON.stringify(data) : 'No se pudo enviar la solicitud. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const whatsappUrl = confirmed
    ? `${whatsappBase}?phone=593991840854&text=${encodeURIComponent(`Hola, he realizado la solicitud de firma número ${confirmed.requestNumber}`)}&type=phone_number&app_absent=0`
    : '';
  const recoveredPaymentPaid = isPaymentPaid(recoveredLookup?.payment?.status);
  const shouldShowPaymentOptions = !recoveredLookup || !recoveredPaymentPaid;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-of1-1.png" alt="FacturaOF1 ERP" className="h-10 w-auto" />
          </Link>
          <Link to="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
            <div className="p-6 sm:p-8">
              <p className="text-sm font-bold uppercase text-blue-600">Firma electrónica</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Solicita tu firma electrónica sin perderte en el proceso
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Ingresa tus datos, sube documentos y revisa todo antes de confirmar. Al finalizar recibirás el número de solicitud para coordinar el pago por WhatsApp.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniTrust icon={<ShieldCheck size={18} />} title="Datos seguros" text="Documentos protegidos." />
                <MiniTrust icon={<Clock3 size={18} />} title="Proceso guiado" text="4 pasos claros." />
                <MiniTrust icon={<FileCheck2 size={18} />} title="Revisión final" text="Nada se envía antes de confirmar." />
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0">
              <p className="text-xs font-bold uppercase text-blue-200">Total seleccionado</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                {tieneDescuento && <span className="pb-1 text-sm font-semibold text-red-200 line-through">{money(precioSeleccionado?.regular_price)}</span>}
                <strong className="text-4xl font-black">{money(totalMostrado)}</strong>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">IVA incluido</span>
                {couponQuote?.applied && <span className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-bold text-violet-200">Cupón aplicado</span>}
                {!couponQuote?.applied && tienePromocion && <span className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-200">Promoción activa</span>}
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Vigencia: <strong className="text-white">{precioSeleccionado?.validity_display ?? form.validity}</strong>
              </p>
            </div>
          </div>
        </section>

        <section className="mb-7 hidden">
          <p className="text-sm font-bold uppercase text-blue-600">Firma electrónica</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Solicitud de firma electrónica</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Completa los datos y documentos requeridos. Al finalizar recibirás un número de solicitud para confirmar el pago por WhatsApp.
          </p>
        </section>

        {!confirmed && (
          <section className="mb-7 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Ya tengo una solicitud</p>
                <h2 className="mt-1 text-base font-black text-slate-950">Consultar solicitud registrada</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Usa el código de solicitud junto con tu cédula, RUC, pasaporte, correo o teléfono registrado.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Código de solicitud">
                  <input
                    className={inputClass}
                    placeholder="FE-2026-000001"
                    value={lookupForm.requestNumber}
                    onChange={(event) => setLookupForm((prev) => ({ ...prev, requestNumber: event.target.value.toUpperCase() }))}
                  />
                </Field>
                <Field label="Dato de verificación">
                  <input
                    className={inputClass}
                    placeholder="Cédula, correo o teléfono"
                    value={lookupForm.verification}
                    onChange={(event) => setLookupForm((prev) => ({ ...prev, verification: event.target.value.toUpperCase() }))}
                  />
                </Field>
              </div>
              <button
                type="button"
                disabled={lookupLoading}
                onClick={() => loadPublicSignature({ requestNumber: lookupForm.requestNumber, verification: lookupForm.verification })}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}
                Consultar
              </button>
            </div>
          </section>
        )}

        <StepIndicator current={step} />

        <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {lookupLoading && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              <Loader2 size={16} className="animate-spin" />
              Cargando información de la solicitud...
            </div>
          )}
          {loading && uploadProgress && <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{uploadProgress}</div>}

          {step === 0 && (
            <div className="space-y-5">
              <StepTitle title="Paso 1 - Datos personales" subtitle="Primero elige el tipo de firma. El formulario y los documentos se ajustan automáticamente." />
              <RequestTypeCards value={form.request_type as TipoSolicitudFirma} onChange={(value) => setField('request_type', value)} />
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Tipo de identificación *" invalid={invalid('identification_type')}>
                  <select className={fieldInputClass(invalid('identification_type'))} value={form.identification_type} onChange={(e) => setField('identification_type', e.target.value)}>
                    <option value="CEDULA">Cédula</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    {isCompanyRequest && <option value="RUC">RUC</option>}
                  </select>
                </Field>
                <Field label="Identificación *" invalid={invalid('identification')}>
                  <input className={fieldInputClass(invalid('identification'))} value={form.identification ?? ''} onChange={(e) => setField('identification', e.target.value)} inputMode={form.identification_type === 'PASAPORTE' ? 'text' : 'numeric'} maxLength={form.identification_type === 'PASAPORTE' ? 20 : form.identification_type === 'RUC' ? 13 : 10} />
                </Field>
                <Field label="Codigo dactilar *" invalid={invalid('fingerprint_code')}>
                  <input className={fieldInputClass(invalid('fingerprint_code'))} placeholder="EXXXXXIXXXX" value={form.fingerprint_code ?? ''} onChange={(e) => setField('fingerprint_code', e.target.value)} />
                </Field>
                <Field label="Nombres *" invalid={invalid('first_name')}>
                  <input className={fieldInputClass(invalid('first_name'))} value={form.first_name ?? ''} onChange={(e) => setField('first_name', e.target.value)} />
                </Field>
                <Field label="1er Apellido *" invalid={invalid('last_name')}>
                  <input className={fieldInputClass(invalid('last_name'))} value={form.last_name ?? ''} onChange={(e) => setField('last_name', e.target.value)} />
                </Field>
                <Field label="2do Apellido">
                  <input className={inputClass} value={form.second_last_name ?? ''} onChange={(e) => setField('second_last_name', e.target.value)} />
                </Field>
                <Field label="Fecha de nacimiento *" invalid={invalid('birth_date')}>
                  <input type="date" className={fieldInputClass(invalid('birth_date'))} value={form.birth_date ?? ''} onChange={(e) => setField('birth_date', e.target.value)} />
                </Field>
                <Field label="Nacionalidad *" invalid={invalid('nationality')}>
                  <input className={fieldInputClass(invalid('nationality'))} value={form.nationality ?? ''} onChange={(e) => setField('nationality', e.target.value)} />
                </Field>
                <Field label="Sexo *" invalid={invalid('gender')}>
                  <select className={fieldInputClass(invalid('gender'))} value={form.gender ?? ''} onChange={(e) => setField('gender', e.target.value)}>
                    <option value="">SELECCIONE...</option>
                    <option value="HOMBRE">HOMBRE</option>
                    <option value="MUJER">MUJER</option>
                    {form.identification_type === 'PASAPORTE' && <option value="OTRO">OTRO</option>}
                  </select>
                </Field>
                <Field label="Teléfono *" invalid={invalid('phone')}>
                  <input className={fieldInputClass(invalid('phone'))} placeholder="09XXXXXXXX" value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} inputMode="tel" />
                </Field>
                <Field label="Teléfono 2">
                  <input className={inputClass} placeholder="09XXXXXXXX" value={form.secondary_phone ?? ''} onChange={(e) => setField('secondary_phone', e.target.value)} inputMode="tel" />
                </Field>
                <Field label="Correo electronico *" invalid={invalid('email')}>
                  <input type="email" className={fieldInputClass(invalid('email'))} value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} />
                </Field>
                <Field label="Correo electronico 2">
                  <input type="email" className={inputClass} value={form.secondary_email ?? ''} onChange={(e) => setField('secondary_email', e.target.value)} />
                </Field>
                {!isCompanyRequest && (
                  <div className="md:col-span-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Con RUC?</p>
                    <div className="flex gap-5 text-sm text-slate-700">
                      <label className="flex items-center gap-2"><input type="radio" checked={Boolean(form.has_ruc)} onChange={() => setField('has_ruc', true)} /> Si</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={!form.has_ruc} onChange={() => setField('has_ruc', false)} /> No</label>
                    </div>
                  </div>
                )}
                {form.request_type === 'PERSONA_NATURAL' && form.has_ruc && (
                  <Field label="Nro. RUC *" invalid={invalid('ruc')}>
                    <input className={fieldInputClass(invalid('ruc'))} value={form.ruc ?? ''} readOnly />
                    <p className="mt-1 text-xs text-slate-500">Se genera automaticamente con la cedula seguida de 001.</p>
                  </Field>
                )}
                {isCompanyRequest && (
                  <>
                    <Field label="Nro. RUC *" invalid={invalid('ruc')}>
                      <input className={fieldInputClass(invalid('ruc'))} value={form.ruc ?? ''} onChange={(e) => setField('ruc', e.target.value)} inputMode="numeric" maxLength={13} />
                    </Field>
                    <Field label="Nombre empresa *" invalid={invalid('business_name')}>
                      <input className={fieldInputClass(invalid('business_name'))} value={form.business_name ?? ''} onChange={(e) => setField('business_name', e.target.value)} />
                    </Field>
                  </>
                )}
                {isCompanyRequest && (
                  <Field label={form.request_type === 'REPRESENTANTE_LEGAL' ? 'Cargo *' : 'Cargo *'} invalid={invalid('applicant_position')}>
                    <input className={fieldInputClass(invalid('applicant_position'))} value={form.applicant_position ?? ''} onChange={(e) => setField('applicant_position', e.target.value)} />
                  </Field>
                )}
                {isMemberRequest && (
                  <>
                    <Field label="Unidad *" invalid={invalid('company_unit')}>
                      <input className={fieldInputClass(invalid('company_unit'))} value={form.company_unit ?? ''} onChange={(e) => setField('company_unit', e.target.value)} />
                    </Field>
                    <Field label="Motivo *" invalid={invalid('request_reason')}>
                      <input className={fieldInputClass(invalid('request_reason'))} value={form.request_reason ?? ''} onChange={(e) => setField('request_reason', e.target.value)} />
                    </Field>
                  </>
                )}
                <Field label="Provincia *" invalid={invalid('province')}>
                  <select className={fieldInputClass(invalid('province'))} value={form.province ?? ''} onChange={(e) => setField('province', e.target.value)}>
                    <option value="">SELECCIONE PROVINCIA</option>
                    {provinceOptions.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select>
                </Field>
                <Field label="Cantón *" invalid={invalid('city')}>
                  <select className={fieldInputClass(invalid('city'))} value={form.city ?? ''} onChange={(e) => setField('city', e.target.value)} disabled={!form.province}>
                    <option value="">SELECCIONE CANTON</option>
                    {cantonesDisponibles.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </Field>
                <Field label="Parroquia *" invalid={invalid('parish')}>
                  <input className={fieldInputClass(invalid('parish'))} value={form.parish ?? ''} onChange={(e) => setField('parish', e.target.value)} />
                </Field>
                <Field label="Dirección *" invalid={invalid('address')}>
                  <input className={fieldInputClass(invalid('address'))} value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} />
                </Field>
                {isMemberRequest && (
                  <>
                    <Field label="Tipo identificación representante legal *" invalid={invalid('representative_identification_type')}>
                      <select className={fieldInputClass(invalid('representative_identification_type'))} value={form.representative_identification_type ?? 'CEDULA'} onChange={(e) => setField('representative_identification_type', e.target.value)}>
                        <option value="CEDULA">Cédula</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="RUC">RUC</option>
                      </select>
                    </Field>
                    <Field label="Identificación representante legal *" invalid={invalid('representative_identification')}>
                      <input className={fieldInputClass(invalid('representative_identification'))} value={form.representative_identification ?? ''} onChange={(e) => setField('representative_identification', e.target.value)} />
                    </Field>
                    <Field label="Nombres representante legal *" invalid={invalid('representative_names')}>
                      <input className={fieldInputClass(invalid('representative_names'))} value={form.representative_names ?? ''} onChange={(e) => setField('representative_names', e.target.value)} />
                    </Field>
                    <Field label="Apellidos representante legal *" invalid={invalid('representative_last_names')}>
                      <input className={fieldInputClass(invalid('representative_last_names'))} value={form.representative_last_names ?? ''} onChange={(e) => setField('representative_last_names', e.target.value)} />
                    </Field>
                  </>
                )}
                <ValidityCards
                  prices={preciosFirma}
                  value={form.validity}
                  selectedPrice={precioSeleccionado}
                  total={totalMostrado}
                  hasDiscount={tieneDescuento}
                  hasCoupon={Boolean(couponQuote?.applied)}
                  hasPromotion={tienePromocion}
                  onChange={changeValidity}
                />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Tag size={17} className="text-blue-700" />
                    <p className="text-sm font-black text-slate-900">Cupón de descuento</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponQuote(null);
                        setCouponMessage('');
                        setField('coupon_code', '');
                      }}
                      placeholder="Ingresa tu código"
                      className={`${inputClass} uppercase sm:max-w-xs`}
                    />
                    <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponInput.trim()} className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                      {couponLoading ? 'Validando...' : 'Aplicar cupón'}
                    </button>
                  </div>
                  {couponMessage && <p className={`mt-2 text-sm ${couponQuote ? 'text-emerald-700' : 'text-red-600'}`}>{couponMessage}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <StepTitle title="Paso 2 - Documentos" subtitle={`${uploadedRequiredDocs} de ${requiredDocs} documentos obligatorios cargados. En el resumen podrás revisar la vista previa.`} />
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {documentConfig.map((doc) => (
                  <FileDrop
                    key={doc.key}
                    config={doc}
                    file={form.archivos?.[doc.key] ?? null}
                    onFile={(file) => setFile(doc.key, file)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepTitle title="Paso 3 - Resumen" subtitle="Revisa cuidadosamente datos, documentos y total antes de pasar a confirmar." />
              <div className="grid gap-4 lg:grid-cols-3">
                <SummaryBlock title="Solicitante" rows={[
                  ['Tipo', tipoLabels[form.request_type as TipoSolicitudFirma]],
                  ['Identificación', `${form.identification_type}: ${form.identification}`],
                  ['Código dactilar', form.fingerprint_code],
                  ['Nombre', `${form.first_name} ${form.last_name} ${form.second_last_name ?? ''}`],
                  ['Nacimiento', form.birth_date],
                  ['Nacionalidad', form.nationality],
                  ['Sexo', form.gender],
                ]} />
                <SummaryBlock title="Contacto y ubicación" rows={[
                  ['Teléfono', form.phone],
                  ['Teléfono 2', form.secondary_phone],
                  ['Correo', form.email],
                  ['Correo 2', form.secondary_email],
                  ['Provincia', form.province],
                  ['Cantón', form.city],
                  ['Parroquia', form.parish],
                  ['Dirección', form.address],
                ]} />
                {(isCompanyRequest || form.has_ruc) && (
                  <SummaryBlock title={isCompanyRequest ? 'Empresa' : 'RUC personal'} rows={isCompanyRequest ? [
                    ['RUC', form.ruc],
                    ['Empresa', form.business_name],
                    ['Unidad', form.company_unit],
                    ['Cargo', form.applicant_position],
                    ['Motivo', form.request_reason],
                    ['Representante', `${form.representative_names ?? ''} ${form.representative_last_names ?? ''}`.trim()],
                  ] : [
                    ['RUC', form.ruc],
                  ]} />
                )}
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-sm font-bold text-slate-700">Documentos cargados</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {documentConfig.map((doc) => (
                    <DocumentPreviewCard
                      key={doc.key}
                      label={doc.label}
                      required={Boolean(doc.required)}
                      file={form.archivos?.[doc.key] ?? null}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && confirmed && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={34} />
              </div>
              <h2 className="text-2xl font-black text-slate-950">Solicitud registrada</h2>
              <p className="mt-3 text-sm text-slate-600">{confirmed.message}</p>
              <p className="mt-4 text-3xl font-black text-blue-700">{confirmed.requestNumber}</p>
              {confirmed.emailStatus && (!confirmed.emailStatus.admin_sent || !confirmed.emailStatus.client_sent) && (
                <div className="mx-auto mt-5 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                  La solicitud fue registrada, pero el servidor no confirmó todos los correos.
                  {!confirmed.emailStatus.admin_sent && <p className="mt-1">Correo interno pendiente: {confirmed.emailStatus.admin_error || 'no confirmado por el proveedor SMTP'}.</p>}
                  {!confirmed.emailStatus.client_sent && <p className="mt-1">Correo al cliente pendiente: {confirmed.emailStatus.client_error || 'no confirmado por el proveedor SMTP'}.</p>}
                </div>
              )}
              {recoveredLookup && <RecoveredSignatureReview lookup={recoveredLookup} />}
              {recoveredLookup && recoveredPaymentPaid && (
                <div className="mx-auto mt-6 max-w-5xl rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-left">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pago registrado</p>
                      <h3 className="mt-1 text-lg font-black text-slate-950">Tu solicitud ya consta como pagada</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        Forma de pago: <strong>{paymentMethodLabel(recoveredLookup.payment)}</strong>
                        {recoveredLookup.payment?.authorization_code ? ` · Autorización: ${recoveredLookup.payment.authorization_code}` : ''}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {shouldShowPaymentOptions && (
                <>
                  <PaymentInstructions whatsappUrl={whatsappUrl} onPayCard={payWithPayPhone} payingCard={payphoneLoading} />
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                    <MessageCircle size={18} />
                    Enviar captura o solicitar link de pago
                  </a>
                </>
              )}
            </div>
          )}

          {step === 3 && !confirmed && (
            <div className="space-y-5">
              <StepTitle title="Paso 4 - Confirmación" subtitle="Este es el último paso. Al confirmar se generará el número de solicitud." />
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                <h3 className="text-base font-black text-slate-950">Confirma tu solicitud de firma electrónica</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Al confirmar se registrará la solicitud, se cargarán los documentos y se enviará la notificación a OF1 Solutions.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <SummaryBlock title="Solicitante" rows={[
                  ['Tipo', tipoLabels[form.request_type as TipoSolicitudFirma]],
                  ['Nombre', `${form.first_name} ${form.last_name} ${form.second_last_name ?? ''}`],
                  ['Identificación', `${form.identification_type}: ${form.identification}`],
                ]} />
                <SummaryBlock title="Contacto" rows={[
                  ['Correo', form.email],
                  ['Teléfono', form.phone],
                  ['Ubicación', [form.parish, form.city, form.province].filter(Boolean).join(', ')],
                ]} />
                <SummaryBlock title="Documentos" rows={[
                  ['Cargados', uploadedDocs],
                  ['Vigencia', precioSeleccionado?.validity_display ?? form.validity],
                  ['Precio normal', money(precioSeleccionado?.regular_price)],
                  ['Cupón', form.coupon_code || 'No aplicado'],
                  ['Total a pagar', money(totalMostrado)],
                  ['IVA', 'Incluido'],
                  ['Contenedor', form.container_type],
                ]} />
              </div>
              <ConsentSection
                acceptedTerms={Boolean(form.accepted_terms)}
                acceptedPrivacy={Boolean(form.accepted_privacy)}
                onAcceptedTerms={(value) => setField('accepted_terms', value)}
                onAcceptedPrivacy={(value) => setField('accepted_privacy', value)}
              />
            </div>
          )}

          {!confirmed && (
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
              <button type="button" onClick={previous} disabled={step === 0 || loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowLeft size={16} />
                Anterior
              </button>
              {step < 3 ? (
                <button type="button" onClick={next} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                  Siguiente
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={confirmRequest} disabled={loading || !form.accepted_terms || !form.accepted_privacy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Confirmar solicitud
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      {payphoneModalOpen && payphonePayment && (
        <PayPhonePaymentModal
          payment={payphonePayment}
          onClose={() => setPayphoneModalOpen(false)}
        />
      )}
      <PublicLegalFooter />
    </div>
  );
}



function RecoveredSignatureReview({ lookup }: { lookup: PublicSignatureLookupResponse }) {
  const solicitud = lookup.solicitud;
  const docs = solicitud.documents ?? [];
  const paid = isPaymentPaid(lookup.payment?.status);
  return (
    <div className="mx-auto mt-8 max-w-5xl rounded-xl border border-blue-100 bg-white p-5 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Información registrada</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Revisa los datos de tu solicitud</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">Estos son los datos ingresados previamente. Si necesitas corregir algo, contáctanos por WhatsApp con tu número de solicitud.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{solicitud.status_display || solicitud.status}</span>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SummaryBlock title="Solicitante" rows={[
          ['Tipo', solicitud.request_type_display || tipoLabels[solicitud.request_type as TipoSolicitudFirma]],
          ['Nombre', solicitud.full_name || `${solicitud.first_name} ${solicitud.last_name} ${solicitud.second_last_name ?? ''}`.trim()],
          ['Identificación', `${solicitud.identification_type}: ${solicitud.identification}`],
          ['Vigencia', solicitud.validity_display || solicitud.validity],
        ]} />
        <SummaryBlock title="Contacto" rows={[
          ['Correo', solicitud.email],
          ['Teléfono', solicitud.phone],
          ['Teléfono 2', solicitud.secondary_phone],
          ['Ubicación', [solicitud.parish, solicitud.city, solicitud.province].filter(Boolean).join(', ')],
          ['Dirección', solicitud.address],
        ]} />
        <SummaryBlock title="Pago" rows={[
          ['Valor firma', money(lookup.payment?.base_amount || solicitud.sale_price)],
          ['Estado pago', paymentStatusLabel(lookup.payment)],
          ['Forma de pago', paymentMethodLabel(lookup.payment)],
          ['Recargo transacción', lookup.payment ? money(lookup.payment.processing_fee) : 'Se mostrará al pagar con tarjeta'],
          ['IVA recargo', lookup.payment ? money(lookup.payment.processing_fee_tax) : 'Se mostrará al pagar con tarjeta'],
          ['Total tarjeta', lookup.payment ? money(lookup.payment.amount) : 'Se calculará al pagar con tarjeta'],
          ['Autorización', paid ? lookup.payment?.authorization_code || lookup.payment?.provider_transaction_id || 'Registrada' : 'Pendiente'],
        ]} />
      </div>
      {(solicitud.business_name || solicitud.ruc || solicitud.representative_names || docs.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SummaryBlock title="Empresa" rows={[
            ['RUC', solicitud.ruc],
            ['Empresa', solicitud.business_name],
            ['Unidad', solicitud.company_unit],
            ['Cargo', solicitud.applicant_position],
            ['Motivo', solicitud.request_reason],
            ['Representante', `${solicitud.representative_names ?? ''} ${solicitud.representative_last_names ?? ''}`.trim()],
          ]} />
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-700">Documentos registrados</h3>
            {docs.length ? (
              <div className="space-y-2">
                {docs.map((doc, index) => (
                  <div key={`${doc.document_type}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-bold uppercase text-slate-500">{doc.document_type_display}</p>
                    <p className="break-words text-sm font-semibold text-slate-800">{doc.file_name || 'Archivo registrado'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay documentos registrados.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PayPhonePaymentModal({ payment, onClose }: { payment: PayPhoneFirmaPaymentResponse; onClose: () => void }) {
  const [sdkError, setSdkError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const renderBox = async () => {
      setSdkError('');
      try {
        await loadPayPhoneAssets();
        if (cancelled) return;
        const container = document.getElementById('payphone-signature-box');
        if (container) container.innerHTML = '';
        if (!window.PPaymentButtonBox || !payment.box_config) {
          setSdkError('No se pudo inicializar la cajita de pagos PayPhone.');
          return;
        }
        const ppb = new window.PPaymentButtonBox({
          ...payment.box_config,
          backgroundColor: '#2563eb',
        });
        ppb.render('payphone-signature-box');
      } catch (err) {
        setSdkError((err as Error)?.message || 'No se pudo cargar PayPhone.');
      }
    };
    renderBox();
    return () => {
      cancelled = true;
    };
  }, [payment]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Pago seguro PayPhone</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Paga tu firma electrónica con tarjeta</h3>
            <p className="mt-1 text-sm text-slate-500">Al completar el pago, PayPhone confirmará la transacción y te enviaremos a la pantalla de resultado.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[0.8fr_1.4fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-black text-slate-950">Detalle del cobro</h4>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Valor firma</dt>
                <dd className="font-bold text-slate-900">{money(payment.base_amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Recargo transacción PayPhone 5%</dt>
                <dd className="font-bold text-slate-900">{money(payment.processing_fee)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">IVA del recargo</dt>
                <dd className="font-bold text-slate-900">{money(payment.processing_fee_tax)}</dd>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between gap-4">
                  <dt className="font-black text-slate-950">Total con tarjeta</dt>
                  <dd className="text-xl font-black text-blue-700">{money(payment.amount)}</dd>
                </div>
              </div>
            </dl>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              El recargo corresponde al costo transaccional de PayPhone y se suma únicamente cuando eliges pagar con tarjeta o cuenta PayPhone.
            </p>
          </div>

          <div className="min-h-[440px] rounded-xl border border-slate-200 bg-white p-4">
            {sdkError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{sdkError}</div>
            ) : (
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                Cargando cajita de pagos...
              </div>
            )}
            <div id="payphone-signature-box" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentInstructions({ whatsappUrl, onPayCard, payingCard }: { whatsappUrl: string; onPayCard: () => void; payingCard: boolean }) {
  return (
    <div className="mx-auto mt-8 max-w-5xl rounded-xl border border-slate-200 bg-slate-50 p-5 text-left">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Datos para pago</p>
          <h3 className="mt-1 text-lg font-black text-slate-950">Realiza la transferencia y envía la captura por WhatsApp</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Una vez realizado el pago, envía la captura al WhatsApp <strong className="text-slate-900">+593 99 184 0854</strong> para continuar con la emisión de tu firma electrónica.
          </p>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
          <MessageCircle size={17} />
          WhatsApp
        </a>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {paymentAccounts.map((account) => (
          <div key={account.accountNumber} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-blue-700">
              <Landmark size={18} />
              <h4 className="text-sm font-black text-slate-950">{account.bank}</h4>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Tipo de cuenta</dt>
                <dd className="font-semibold text-slate-800">{account.accountType}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Nro. de cuenta</dt>
                <dd className="font-black text-slate-950">{account.accountNumber}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase text-slate-500">Titular</dt>
                <dd className="font-semibold text-slate-800">{account.holder}</dd>
              </div>
              {account.identification && (
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Identificación</dt>
                  <dd className="font-semibold text-slate-800">{account.identification}</dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-blue-100 bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CreditCard size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-950">Pago con tarjeta</h4>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Paga de forma segura con PayPhone usando tarjeta de crédito, débito o cuenta PayPhone.
              </p>
            </div>
          </div>
          <button type="button" onClick={onPayCard} disabled={payingCard} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {payingCard ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
            {payingCard ? 'Generando pago...' : 'Pagar con tarjeta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentSection({
  acceptedTerms,
  acceptedPrivacy,
  onAcceptedTerms,
  onAcceptedPrivacy,
}: {
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  onAcceptedTerms: (value: boolean) => void;
  onAcceptedPrivacy: (value: boolean) => void;
}) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-950">Consentimiento y aceptación</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Para procesar la solicitud debemos registrar tu autorización expresa y la aceptación de los documentos legales vigentes.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => onAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            He leído y acepto los{' '}
            <Link to="/terminos-y-condiciones" target="_blank" className="font-bold text-blue-700 hover:underline">
              Términos y Condiciones
            </Link>
            .
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(event) => onAcceptedPrivacy(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            Autorizo expresamente a OF1 Solutions S.A.S. el tratamiento de mis datos personales para la gestión de mi solicitud de Firma Electrónica, validación de identidad, emisión de certificados y cumplimiento de obligaciones legales. Conozco la{' '}
            <Link to="/politica-privacidad" target="_blank" className="font-bold text-blue-700 hover:underline">
              Política de Privacidad
            </Link>
            .
          </span>
        </label>
      </div>
    </section>
  );
}

function PublicLegalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} OF1 Solutions S.A.S. Todos los derechos reservados.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/politica-privacidad" className="font-semibold text-slate-600 hover:text-blue-700">Política de Privacidad</Link>
          <Link to="/terminos-y-condiciones" className="font-semibold text-slate-600 hover:text-blue-700">Términos y Condiciones</Link>
        </div>
      </div>
    </footer>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {steps.map((label, index) => {
        const active = index <= current;
        return (
          <div key={label} className={`rounded-xl border p-3 ${active ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {index < current ? <Check size={15} /> : index + 1}
            </div>
            <p className={`mt-2 text-sm font-bold ${active ? 'text-blue-900' : 'text-slate-500'}`}>{label}</p>
          </div>
        );
      })}
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {subtitle && <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>}
    </div>
  );
}

function MiniTrust({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">{icon}</div>
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function ValidityCards({
  prices,
  value,
  selectedPrice,
  total,
  hasDiscount,
  hasCoupon,
  hasPromotion,
  onChange,
}: {
  prices: PrecioFirma[];
  value?: string;
  selectedPrice?: PrecioFirma;
  total?: string | number;
  hasDiscount: boolean;
  hasCoupon: boolean;
  hasPromotion: boolean;
  onChange: (value: VigenciaFirma) => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 md:col-span-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-blue-700">Elige la vigencia</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Selecciona por cuánto tiempo necesitas tu firma</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            La opción marcada es la que se usará para calcular el valor final de la solicitud.
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Total seleccionado</p>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            {hasDiscount && (
              <span className="pb-1 text-sm font-semibold text-red-500 line-through">
                {money(selectedPrice?.regular_price)}
              </span>
            )}
            <strong className="text-3xl font-black text-slate-950">{money(total)}</strong>
            <span className="mb-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">IVA incluido</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hasCoupon && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">Cupón aplicado</span>}
            {!hasCoupon && hasPromotion && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">Promoción activa</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {prices.map((price) => {
          const selected = value === price.validity;
          const discounted = Number(price.current_price) < Number(price.regular_price);
          return (
            <button
              key={price.validity}
              type="button"
              onClick={() => onChange(price.validity)}
              className={`min-h-[7rem] rounded-2xl border p-4 text-left transition ${
                selected
                  ? 'border-blue-600 bg-white shadow-md ring-4 ring-blue-100'
                  : 'border-slate-200 bg-white/80 hover:border-blue-300 hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-slate-950">{price.validity_display}</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {discounted && <span className="text-xs font-semibold text-red-500 line-through">{money(price.regular_price)}</span>}
                    <span className="text-2xl font-black text-blue-700">{money(price.current_price)}</span>
                  </div>
                </div>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-transparent'
                }`}>
                  <Check size={15} />
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {selected ? 'Vigencia seleccionada' : 'Toca para seleccionar'}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RequestTypeCards({ value, onChange }: { value: TipoSolicitudFirma; onChange: (value: TipoSolicitudFirma) => void }) {
  const options: TipoSolicitudFirma[] = ['PERSONA_NATURAL', 'MIEMBRO_EMPRESA', 'REPRESENTANTE_LEGAL'];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm font-black text-slate-950">{tipoLabels[option]}</strong>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-transparent'}`}>
                <Check size={14} />
              </span>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-500">{tipoDescriptions[option]}</p>
          </button>
        );
      })}
    </div>
  );
}

function FileDrop({ config, file, onFile }: { config: DocumentConfig; file: File | null; onFile: (file: File | null) => void }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {config.label}{config.required ? ' *' : ''}
        <span className="ml-1 normal-case text-slate-400">{config.helper}</span>
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.currentTarget.value = '';
        }}
      />
      <div className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-blue-400 hover:bg-blue-50">
        {file ? (
          <>
            <CheckCircle2 className="mb-3 text-emerald-600" size={28} />
            <p className="max-w-full truncate text-sm font-bold text-slate-800">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">{fileSizeMb(file)} MB</p>
          </>
        ) : (
          <>
            <FileUp className="mb-3 text-blue-600" size={28} />
            <p className="text-sm font-bold text-slate-800">Arrastra el archivo para cargar</p>
            <p className="mt-1 text-xs text-slate-500">o clic aquí. Máximo 15 MB.</p>
          </>
        )}
      </div>
    </label>
  );
}

function DocumentPreviewCard({ label, required, file }: { label: string; required: boolean; file: File | null }) {
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isImage = Boolean(file?.type.startsWith('image/'));
  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="truncate text-xs text-slate-500">{file?.name ?? (required ? 'Pendiente' : 'Opcional')}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${file ? 'bg-emerald-100 text-emerald-700' : required ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
          {file ? 'Cargado' : required ? 'Falta' : 'Opcional'}
        </span>
      </div>
      {file && previewUrl && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {isImage ? (
            <img src={previewUrl} alt={label} className="h-44 w-full object-contain" />
          ) : isPdf ? (
            <div className="flex h-44 flex-col items-center justify-center gap-3">
              <FileUp className="text-red-500" size={32} />
              <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Ver PDF
              </a>
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center text-sm text-slate-500">Vista previa no disponible</div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryBlock({ title, rows }: { title: string; rows: Array<[string, ReactNode]> }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-700">{title}</h3>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-l-2 border-blue-500 pl-3">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="break-words text-sm text-slate-800">{value || '-'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
