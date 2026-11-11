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
  },
  en: {
    hello: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    todayLabel: 'Today',
    medicines: "Today's medicines",
    appointment: 'Next check-up',
    call: 'Call my children',
    back: 'Home',
    comingSoon: 'This part is being built.',
  },
} as const;

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
