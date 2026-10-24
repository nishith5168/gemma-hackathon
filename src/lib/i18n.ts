export type Language = 'en' | 'si' | 'ta';

export interface PatientStrings {
  title: string;
  tagline: string;
  disclaimer: string;
  searchPlaceholder: string;
  districtLabel: string;
  allDistricts: string;
  useLocation: string;
  scanPrescription: string;
  scanningGemma: string;
  prescriptionReadHeader: string;
  exactVariantNotice: string;
  chooseVariant: string;
  findAvailability: string;
  inStock: string;
  lowStock: string;
  outOfStock: string;
  lastVerified: string;
  staleWarning: string;
  askConfirm: string;
  requestReservation: string;
  myRequests: string;
  notifications: string;
  savedMedicines: string;
  noResults: string;
  reserveModalTitle: string;
  reserveModalDesc: string;
  quantityLabel: string;
  notesLabel: string;
  submitRequest: string;
  cancel: string;
}

export const I18N: Record<Language, PatientStrings> = {
  en: {
    title: 'MedSignal LK — Patient Portal',
    tagline: 'Real-time medicine availability across Sri Lankan pharmacies.',
    disclaimer:
      'Shows pharmacy-reported availability only. Never suggests substitutions or dosage changes. The pharmacist verifies your prescription at collection.',
    searchPlaceholder: 'Search by generic name or brand (e.g. Salbutamol, Metformin)...',
    districtLabel: 'District',
    allDistricts: 'All Districts',
    useLocation: 'Use my location',
    scanPrescription: 'Scan Prescription Photo',
    scanningGemma: 'Gemma 4 is reading prescription...',
    prescriptionReadHeader: 'Prescription Items Detected by AI',
    exactVariantNotice: 'Exact-variant matching protects against improper substitutions.',
    chooseVariant: 'Select Variant',
    findAvailability: 'Check Stock',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    lastVerified: 'Last verified',
    staleWarning: 'Unverified in >48h',
    askConfirm: 'Ask to Confirm',
    requestReservation: 'Request Hold',
    myRequests: 'My Requests',
    notifications: 'Notifications',
    savedMedicines: 'Saved Refills',
    noResults: 'No pharmacies currently reporting stock for this exact medicine in this area.',
    reserveModalTitle: 'Request Medicine Hold',
    reserveModalDesc:
      'Ask the pharmacy to hold stock until you arrive with your doctor’s prescription.',
    quantityLabel: 'Quantity needed',
    notesLabel: 'Note for pharmacist (optional)',
    submitRequest: 'Send Request',
    cancel: 'Cancel',
  },
  si: {
    title: 'MedSignal LK — රෝගී සේවා පිවිසුම',
    tagline: 'ශ්‍රී ලංකාවේ බලපත්‍රලාභී ෆාමසිවල ඖෂධ ලබාගැනීමේ හැකියාව.',
    disclaimer:
      'ෆාමසි මගින් වාර්තා කරන ලද ඖෂධ තොග පමණක් පෙන්වයි. කිසිදු වෛද්‍ය උපදෙස් හෝ ආදේශන ලබා නොදේ. ඖෂධ ලබාගැනීමේදී වෛද්‍ය නිර්දේශය ෆාමසිය විසින් පරීක්ෂා කරනු ලැබේ.',
    searchPlaceholder: 'ඖෂධයේ නම සොයන්න (උදා: Salbutamol, Metformin)...',
    districtLabel: 'දිස්ත්‍රික්කය',
    allDistricts: 'සියලු දිස්ත්‍රික්ක',
    useLocation: 'මගේ ස්ථානය භාවිත කරන්න',
    scanPrescription: 'බෙහෙත් වට්ටෝරුව ඡායාරූප ගත කරන්න',
    scanningGemma: 'Gemma AI බෙහෙත් වට්ටෝරුව කියවමින් පවතී...',
    prescriptionReadHeader: 'AI මගින් හඳුනාගත් ඖෂධ',
    exactVariantNotice: 'නිවැරදි මාත්‍රාව සහ වර්ගය තහවුරු කරගන්න.',
    chooseVariant: 'වර්ගය තෝරන්න',
    findAvailability: 'තොග පරීක්ෂා කරන්න',
    inStock: 'තොග ඇත',
    lowStock: 'සීමිත තොග',
    outOfStock: 'තොග අවසන්',
    lastVerified: 'අවසන් වරට තහවුරු කළේ',
    staleWarning: 'පැය 48කින් තහවුරු කර නැත',
    askConfirm: 'තහවුරු කිරීමක් ඉල්ලන්න',
    requestReservation: 'වෙන්කරවා ගැනීමක් ඉල්ලන්න',
    myRequests: 'මගේ ඉල්ලීම්',
    notifications: 'දැනුම්දීම්',
    savedMedicines: 'සුරකින ලද ඖෂධ',
    noResults: 'මෙම ප්‍රදේශයේ තොග වාර්තා කර නොමැත.',
    reserveModalTitle: 'ඖෂධ වෙන්කරවා ගැනීමේ ඉල්ලීම',
    reserveModalDesc: 'ඔබ පැමිණෙන තෙක් ඖෂධය වෙන්කර තබන ලෙස ෆාමසියෙන් ඉල්ලන්න.',
    quantityLabel: 'අවශ්‍ය ප්‍රමාණය',
    notesLabel: 'සටහන (අවශ්‍ය නම්)',
    submitRequest: 'ඉල්ලීම යවන්න',
    cancel: 'අවලංගු කරන්න',
  },
  ta: {
    title: 'MedSignal LK — நோயாளி போர்டல்',
    tagline: 'இலங்கை மருந்தகங்களில் மருந்துகளின் இருப்பு விவரங்கள்.',
    disclaimer:
      'மருந்தகங்கள் வழங்கிய இருப்பு தகவல்களை மட்டுமே காட்டுகிறது. மருத்துவ ஆலோசனையோ அல்லது மாற்று மருந்துகளையோ வழங்காது.',
    searchPlaceholder: 'மருந்தின் பெயரைத் தேடுக (எ.கா: சல்புடமால்)...',
    districtLabel: 'மாவட்டம்',
    allDistricts: 'அனைத்து மாவட்டங்களும்',
    useLocation: 'எனது இருப்பிடத்தைப் பயன்படுத்து',
    scanPrescription: 'மருந்துச் சீட்டைப் படம் எடுக்க',
    scanningGemma: 'Gemma AI மருந்துச் சீட்டைப் படிக்கிறது...',
    prescriptionReadHeader: 'AI கண்டறிந்த மருந்துகள்',
    exactVariantNotice: 'சரியான அளவையும் வகையையும் உறுதிப்படுத்தவும்.',
    chooseVariant: 'வகையைத் தேர்ந்தெடுக்க',
    findAvailability: 'இருப்பைச் சரிபார்க்கவும்',
    inStock: 'இருப்பு உள்ளது',
    lowStock: 'குறைந்த இருப்பு',
    outOfStock: 'இருப்பு இல்லை',
    lastVerified: 'கடைசியாக சரிபார்க்கப்பட்டது',
    staleWarning: '48 மணி நேரமாக சரிபார்க்கப்படவில்லை',
    askConfirm: 'உறுதிப்படுத்தக் கேட்க',
    requestReservation: 'முன்பதிவு கோரிக்கை',
    myRequests: 'எனது கோரிக்கைகள்',
    notifications: 'அறிவிப்புகள்',
    savedMedicines: 'சேமிக்கப்பட்ட மருந்துகள்',
    noResults: 'இந்த பகுதியில் இருப்புத் தகவல்கள் இல்லை.',
    reserveModalTitle: 'மருந்து முன்பதிவு கோரிக்கை',
    reserveModalDesc: 'நீங்கள் நேரில் வரும் வரை மருந்தை ஒதுக்கி வைக்கக் கோருங்கள்.',
    quantityLabel: 'தேவையான அளவு',
    notesLabel: 'குறிப்பு',
    submitRequest: 'கோரிக்கையை அனுப்புக',
    cancel: 'ரத்து செய்',
  },
};
