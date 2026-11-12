/**
 * Parent mode copy. Vietnamese first (the parents in the case study read
 * Vietnamese), English as a fallback. Wording follows the hi-fi.
 */

export type ParentLang = 'vi' | 'en';

const strings = {
  vi: {
    hello: { morning: 'Chào buổi sáng', afternoon: 'Chào buổi chiều', evening: 'Chào buổi tối' },
    todayLabel: 'Hôm nay',
    medicines: 'Thuốc hôm nay',
    appointment: 'Lịch khám tới',
    call: 'Gọi cho con',
    back: 'Về trang chính',
    comingSoon: 'Phần này đang được làm.',
    consentTitle: (h: string) => `${cap(h)} muốn chia sẻ gì với con cháu?`,
    consentSub: (h: string) => `${cap(h)} có thể đổi lại bất cứ lúc nào.`,
    consentAreas: {
      medicines: 'Thuốc hôm nay',
      appointments: 'Lịch khám',
      health: 'Chỉ số huyết áp',
      emergency_location: 'Vị trí khi gọi khẩn cấp',
    },
    agree: 'Đồng ý',
    sharing: 'Điều tôi chia sẻ',
    callThen: (names: string[]) => (names.length > 1 ? `Gọi ${names[0]} trước, rồi ${names.slice(1).join(', ')}` : `Gọi ${names[0]}`),
    callPerson: (name: string) => `Gọi ${name}`,
    noOneToCall: 'Chưa có ai trong danh sách gọi. Nhờ con cháu thêm số điện thoại trong Tend.',
    noAppointment: 'Chưa có lịch khám nào.',
    driver: (name: string) => `${name} sẽ đưa đi`,
    noDriver: 'Chưa có ai đưa đi. Con cháu đang sắp xếp.',
    deliveries: 'Sắp giao tới nhà',
  },
  en: {
    hello: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    todayLabel: 'Today',
    medicines: "Today's medicines",
    appointment: 'Next check-up',
    call: 'Call my children',
    back: 'Home',
    comingSoon: 'This part is being built.',
    consentTitle: (_h: string) => 'What would you like to share with your family?',
    consentSub: (_h: string) => 'You can change this any time.',
    consentAreas: {
      medicines: "Today's medicines",
      appointments: 'Appointments',
      health: 'Blood pressure readings',
      emergency_location: 'Location during emergency calls',
    },
    agree: 'I agree',
    sharing: 'What I share',
    callThen: (names: string[]) => (names.length > 1 ? `${names[0]} first, then ${names.slice(1).join(', ')}` : `Call ${names[0]}`),
    callPerson: (name: string) => `Call ${name}`,
    noOneToCall: 'No one to call yet. Ask your family to add their phone numbers in Tend.',
    noAppointment: 'No check-ups booked.',
    driver: (name: string) => `${name} will take you`,
    noDriver: 'No one to take you yet. The family is arranging it.',
    deliveries: 'Coming to your home',
  },
};

export function parentStrings(lang: ParentLang = 'vi') {
  return strings[lang];
}

export function greeting(lang: ParentLang, now = new Date()) {
  const h = now.getHours();
  const hello = strings[lang].hello;
  return h < 12 ? hello.morning : h < 18 ? hello.afternoon : hello.evening;
}

export function longDate(lang: ParentLang, now = new Date()) {
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const HONORIFICS = ['ông', 'bà', 'bố', 'mẹ', 'ba', 'má', 'cô', 'chú', 'bác', 'dì', 'cậu'];

/**
 * How parent mode addresses the parent in Vietnamese, taken from the name the
 * family typed ("ông Hòa" → "ông"). Falls back to "bạn".
 */
export function honorific(displayName: string | null | undefined) {
  const first = (displayName ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return HONORIFICS.includes(first) ? first : 'bạn';
}
