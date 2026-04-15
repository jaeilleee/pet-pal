/**
 * auto-events.ts -- 부재 중 펫의 자율 행동 로그
 */

import type { Personality } from './pets';

const EVENTS: Record<Personality, string[]> = {
  active: [
    '마당을 50바퀴 뛰었어요 🏃',
    '소파 위에서 쿵쿵 뛰었어요',
    '신발을 물어다 숨겼어요 👟',
    '문 앞에서 계속 기다렸어요',
    '꼬리를 잡으려고 빙글빙글 돌았어요 🌀',
  ],
  foodie: [
    '간식통을 몰래 열어봤어요 🍪',
    '냉장고 앞에서 30분 서있었어요',
    '꿈에서 스테이크를 먹었어요 🥩',
    '빈 그릇을 핥고 있었어요',
    '옆집 냄새를 맡으며 침을 흘렸어요 🤤',
  ],
  gentle: [
    '창가에서 비를 구경했어요 🌧️',
    '조용히 주인 냄새나는 옷 위에서 잤어요',
    '햇빛 따라 자리를 옮겼어요 ☀️',
    '아무도 없는 방에서 가만히 있었어요',
    '부드럽게 그루밍을 했어요 ✨',
  ],
  playful: [
    '장난감을 전부 꺼내놨어요 🧸',
    '커튼에 매달렸다가 떨어졌어요',
    '그림자랑 놀았어요 👤',
    '박스 안에 숨어서 깜짝 놀래킬 준비했어요 📦',
    '볼펜 뚜껑을 굴리며 놀았어요',
  ],
  sleepy: [
    '18시간 연속으로 잤어요 💤',
    '이불 속에 파고들어 안 나왔어요',
    '코 골면서 잠꼬대했어요',
    '눈 뜨자마자 다시 잤어요',
    '베개를 차지하고 안 내줬어요 🛏️',
  ],
};

/** 부재 시간에 따라 자율 행동 로그 생성 (3시간당 1개, 최대 3개) */
export function generateAutoEvents(personality: Personality, absentHours: number): string[] {
  if (absentHours < 1) return [];
  const count = Math.min(3, Math.floor(absentHours / 3));
  if (count === 0) return [];
  const pool = EVENTS[personality];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// === Multi-Pet Interaction Events ===

const MULTI_PET_EVENTS: string[] = [
  '{pet1}이(가) {pet2}에게 간식을 나눠줬어요 🍪',
  '{pet1}이(가) {pet2}를 깨워서 같이 놀았어요',
  '{pet1}이(가) {pet2}의 자리를 빼앗았어요 😤',
  '{pet1}이(가) {pet2}에게 코를 비볐어요 💕',
  '{pet1}이(가) {pet2}를 따라다녔어요',
  '{pet1}이(가) {pet2}에게 장난을 쳤어요 🤣',
  '{pet1}이(가) {pet2}와 나란히 잤어요 😴',
  '{pet1}이(가) {pet2}의 먹이를 훔쳐먹었어요',
];

/** 멀티펫 상호작용 이벤트 생성 (펫 2마리 이상 + 부재 2시간 이상) */
export function generateMultiPetEvents(
  pets: Array<{ name: string }>,
  absentHours: number,
): string[] {
  if (pets.length < 2 || absentHours < 2) return [];
  const count = Math.min(2, Math.floor(absentHours / 4));
  if (count === 0) return [];

  const results: string[] = [];
  const shuffled = [...MULTI_PET_EVENTS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    // 랜덤 2마리 선택
    const indices = [...Array(pets.length).keys()].sort(() => Math.random() - 0.5);
    const pet1 = pets[indices[0]];
    const pet2 = pets[indices[1]];
    const template = shuffled[i % shuffled.length];
    results.push(
      template.replace('{pet1}', pet1.name).replace('{pet2}', pet2.name),
    );
  }
  return results;
}
