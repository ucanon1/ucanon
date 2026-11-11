// 호그와트 기숙사 컵 콘텐츠: 기숙사, 문항, 확신도 단계, 첫 화면 안내문.
// 지민이가 만든 원본(Hogwarts.html)에서 옮겨 왔습니다. 문항을 고칠 때는 이 파일만 수정합니다.
// 문항 수를 바꾸면 firestore.rules의 maxQuestions()와 firebase-config.js의 TOTAL_QUESTIONS도 맞춥니다.

export const HOUSES = [
  {
    "id": "Gryffindor",
    "icon": "🦁",
    "color": "red",
    "name": "GRYFFINDOR",
    "traits": "용기 · 대담함 · 결단력 · 기사도",
    "desc": "그리핀도르는 용기와 대담함, 그리고 자신의 신념을 지킬 수 있는 용기를 중요하게 생각합니다. 어려운 상황에서도 정면으로 도전하며, 쉽게 물러서지 않는 마법사들이 모이는 곳입니다. 무엇보다 자신의 용기를 믿는다면, 그리핀도르가 당신의 자리가 될지도 모릅니다.",
    "en": "Courage · Bravery · Determination · Chivalry",
    "edesc": "Gryffindor values courage, daring, and the strength to stand by your beliefs. Its members face difficult situations head-on and do not back down easily. If you trust your courage above all, Gryffindor may be your place."
  },
  {
    "id": "Ravenclaw",
    "icon": "🦅",
    "color": "blue",
    "name": "RAVENCLAW",
    "traits": "지성 · 지혜 · 호기심 · 배움",
    "desc": "래번클로는 지성과 지혜, 그리고 세상에 대한 끊임없는 호기심을 중요하게 생각합니다. 단순히 답을 아는 데 그치지 않고, 왜 그것이 답인지 이해하려는 마법사들이 모이는 곳입니다. 배움이 어디로 이끌든 그 길을 따라가고 싶다면, 래번클로가 당신을 기다리고 있을지도 모릅니다.",
    "en": "Intelligence · Wisdom · Curiosity · Learning",
    "edesc": "Ravenclaw values intelligence, wisdom, and a lasting curiosity about the world. Its members want to understand why an answer is right, not simply know the answer. If you want to follow learning wherever it leads, Ravenclaw may be waiting."
  },
  {
    "id": "Hufflepuff",
    "icon": "🦡",
    "color": "yellow",
    "name": "HUFFLEPUFF",
    "traits": "충성 · 인내 · 성실 · 공정함",
    "desc": "후플푸프는 인내와 성실함, 공정함, 그리고 정직하게 노력하는 자세를 중요하게 생각합니다. 뛰어난 재능만으로 이루어지는 성취보다, 꾸준한 노력과 끈기가 만들어내는 성취를 믿습니다. 정직함과 끈기를 중요하게 생각한다면, 후플푸프가 당신의 집이 될지도 모릅니다.",
    "en": "Loyalty · Patience · Diligence · Fairness",
    "edesc": "Hufflepuff values patience, diligence, fairness, and honest effort. Its members believe in achievements built through steady work and perseverance. If you value honesty and persistence, Hufflepuff may be your home."
  },
  {
    "id": "Slytherin",
    "icon": "🐍",
    "color": "green",
    "name": "SLYTHERIN",
    "traits": "야망 · 기지 · 자원 활용 · 결단력",
    "desc": "슬리데린은 야망과 결단력, 기지, 그리고 어려운 상황을 전략적으로 헤쳐 나가는 능력을 중요하게 생각합니다. 자신이 무엇을 원하는지 알고, 그 목표를 이루기 위해 어떻게 행동해야 하는지를 신중하게 판단하는 마법사들이 모이는 곳입니다. 자신의 야망과 판단력을 믿는다면, 슬리데린이 당신을 기다리고 있을지도 모릅니다.",
    "en": "Ambition · Cunning · Resourcefulness · Determination",
    "edesc": "Slytherin values ambition, determination, cunning, and the ability to navigate difficult situations strategically. Its members know what they want and carefully decide how to reach it. If you trust your ambition and judgment, Slytherin may be waiting for you."
  }
];

export const TIERS = [95,75,60,45,30];

export const QUESTIONS = [
  {
    "id": "Q1",
    "title": "기숙사 배정식",
    "enTitle": "The Sorting Ceremony",
    "ko": "기숙사 배정식에서 마법의 모자가 해리에게 슬리데린 기숙사를 제안하자, 해리는 깊은 고민에 빠졌습니다. 해리는 **“용감한 마법사는 무조건 그리핀도르로 가야 하며, 슬리데린에 가면 무조건 사악한 마왕의 하수인이 된다”**며 오직 두 가지 선택지만 존재한다고 생각했습니다.\n\n해리의 사고방식에 포함된 논리적 오류는 무엇일까요?",
    "en": "During the Sorting Ceremony, the Sorting Hat suggests that Harry might belong in Slytherin. Harry becomes deeply troubled. He thinks, “A brave wizard must go to Gryffindor, and anyone who goes to Slytherin will inevitably become a servant of the Dark Lord.” He assumes there are only two possible choices.\n\nWhat logical fallacy appears in Harry’s reasoning?",
    "choices": [
      "False Dilemma (거짓 딜레마 / 흑백논리)",
      "Fallacy of Accident (우연의 오류)",
      "Equivocation (애매어의 오류)",
      "Straw Man Fallacy (짚단 논증의 오류)"
    ],
    "enChoices": [
      "False Dilemma",
      "Fallacy of Accident",
      "Equivocation",
      "Straw Man Fallacy"
    ],
    "answer": "A"
  },
  {
    "id": "Q2",
    "title": "밤의 복도",
    "enTitle": "The Corridor at Night",
    "ko": "해리, 론, 헤르미온느, 네빌은 밤에 기숙사를 몰래 나왔다가 필치에게 들킬 위기에 처했습니다.\n\n헤르미온느가 말했습니다.\n“학생은 밤에 기숙사를 떠나면 안 된다는 규칙이 있으니, 우리가 규칙을 어긴 것은 맞아. 하지만 누군가 위험에 처해서 도움을 요청해야 하는 상황이라면 다를 수도 있어.”\n\n그러자 다른 학생이 말했습니다.\n“규칙은 모든 학생에게 적용되는 거야. 어떤 상황에서도 예외는 없어.”\n\n이 주장의 문제를 가장 잘 설명하는 것은?",
    "en": "Harry, Ron, Hermione, and Neville secretly leave their dormitory at night and are in danger of being caught by Filch.\n\nHermione says: “There is a rule that students must not leave their dormitories at night, so we did break the rule. But the situation might be different if someone is in danger and we need to leave to get help.”\n\nAnother student responds: “The rule applies to every student. There are no exceptions, no matter what the situation is.”\n\nWhich best describes the problem with this reasoning?",
    "choices": [
      "False Dilemma (거짓 딜레마)",
      "Fallacy of Accident (우연의 오류)",
      "Appeal to Tradition (전통에 호소)",
      "Begging the Question (선결문제 요구)"
    ],
    "enChoices": [
      "False Dilemma",
      "Fallacy of Accident",
      "Appeal to Tradition",
      "Begging the Question"
    ],
    "answer": "B"
  },
  {
    "id": "Q3",
    "title": "마법약 수업",
    "enTitle": "Potions Class",
    "ko": "스네이프 교수가 말했습니다.\n“이 마법약은 위험하다.”\n\n학생 A는 이것을 듣고 “위험하다는 것은 절대로 사용해서는 안 된다는 뜻이다.”라고 주장했습니다.\n\n하지만 스네이프는 “위험하다”는 말을 **“잘못 사용하면 심각한 결과를 초래할 수 있다”**는 의미로 사용했습니다.\n\n이 상황에서 가장 적절한 개념은?",
    "en": "Professor Snape says: “This potion is dangerous.”\n\nStudent A concludes: “If it is dangerous, it must never be used.”\n\nHowever, Snape meant “dangerous” to mean “capable of causing serious consequences if used improperly.”\n\nWhich concept best describes the problem?",
    "choices": [
      "Ambiguity (모호성)",
      "Vagueness (애매성)",
      "Equivocation (애매어의 오류)",
      "Amphiboly (애매구문의 오류)"
    ],
    "enChoices": [
      "Ambiguity",
      "Vagueness",
      "Equivocation",
      "Amphiboly"
    ],
    "answer": "C"
  },
  {
    "id": "Q4",
    "title": "말포이와 헤르미온느",
    "enTitle": "Malfoy and Hermione",
    "ko": "수업 중 말포이가 헤르미온느의 머글 출신 배경을 비꼬며 그녀를 놀렸습니다.\n헤르미온느가 불쾌해하자 론이 말했습니다.\n“사람의 출신 때문에 그 사람의 능력을 판단해서는 안 돼.”\n\n그러자 말포이가 대답했습니다.\n“그러니까 론은 순수혈통 마법사들이 가진 모든 전통과 가치가 잘못됐다고 생각하는 거네.”\n\n말포이의 논리적 오류는 무엇일까요?",
    "en": "During class, Malfoy mocks Hermione because of her Muggle-born background. When Hermione becomes upset, Ron says: “We shouldn’t judge someone’s abilities based on where they come from.”\n\nMalfoy responds: “So Ron thinks that all the traditions and values of pure-blood wizards are wrong.”\n\nWhat logical fallacy is Malfoy committing?",
    "choices": [
      "Straw Man (허수아비 오류)",
      "Red Herring (논점 일탈)",
      "Loaded Question (복합질문 / 함정 질문)",
      "Fallacy of Accident (우연의 오류)"
    ],
    "enChoices": [
      "Straw Man",
      "Red Herring",
      "Loaded Question",
      "Fallacy of Accident"
    ],
    "answer": "A"
  },
  {
    "id": "Q5",
    "title": "첫 번째 퀴디치 경기",
    "enTitle": "The First Quidditch Match",
    "ko": "해리의 첫 퀴디치 경기에서 해리의 빗자루가 갑자기 심하게 흔들리기 시작했습니다.\n헤르미온느는 관중석에서 스네이프가 해리를 노려보고 있는 단 한 번의 단편적인 모습을 발견했습니다.\n\n헤르미온느가 말했습니다.\n\n“스네이프가 해리를 바라보고 있었어. 그러니까 스네이프가 해리의 빗자루를 저주한 게 틀림없어.”\n\n이 관찰을 바탕으로 헤르미온느가 내린 결론의 논리적 문제는 무엇일까요?",
    "en": "During Harry's first Quidditch match, his broomstick suddenly begins to shake violently.\n\nFrom the stands, Hermione catches a single isolated glimpse of Snape staring at Harry.\n\nHermione says:\n\n“Snape was staring right at Harry. So Snape must have cursed Harry's broom.”\n\nWhat is the logical flaw in the conclusion Hermione draws from this observation?",
    "choices": [
      "Hasty Generalization (성급한 일반화)",
      "Missing the Point / Non-sequitur (논점 일탈 / 추론 비약의 오류)",
      "Red Herring (붉은 훈제어의 오류)",
      "Fallacy of Accident (우연의 오류)"
    ],
    "enChoices": [
      "Hasty Generalization",
      "Missing the Point / Non-sequitur",
      "Red Herring",
      "Fallacy of Accident"
    ],
    "answer": "A"
  },
  {
    "id": "Q6",
    "title": "예언 수업",
    "enTitle": "Divination Class",
    "ko": "점술 수업에서 파르바티는 **“이번 주에는 그리핀도르 학생들이 사고를 많이 칠 것이다”**라고 믿었습니다.\n다음 일주일 동안 그녀는 그리핀도르 학생이 규칙을 어긴 사례 3건을 기억했지만, 규칙을 잘 지킨 사례 30건은 거의 기억하지 못했습니다.\n\n이 현상을 가장 잘 설명하는 것은?",
    "en": "In Divination class, Parvati believes: “Gryffindor students are going to cause a lot of trouble this week.”\n\nDuring the week, she remembers three cases in which Gryffindor students broke rules but barely remembers the thirty cases in which they followed the rules.\n\nWhich concept best explains this?",
    "choices": [
      "Confirmation Bias (확증편향)",
      "Hindsight Bias (사후확신편향)",
      "Sunk Cost Fallacy (매몰비용 오류)",
      "Halo Effect (후광효과)"
    ],
    "enChoices": [
      "Confirmation Bias",
      "Hindsight Bias",
      "Sunk Cost Fallacy",
      "Halo Effect"
    ],
    "answer": "A"
  },
  {
    "id": "Q7",
    "title": "마법사의 돌",
    "enTitle": "The Philosopher’s Stone",
    "ko": "네빌은 50갈레온을 주고 구입한 빗자루가 고장 났다는 사실을 알게 되었습니다. 새로운 빗자루를 사는 것이 훨씬 좋은 선택이지만, 그는 말합니다.\n“빗자루가 고장 나서 새 빗자루를 사야 하긴 하지만, 덕분에 빗자루를 직접 고치는 법을 배웠으니 오히려 잘된 일이야.”\n\n이 사고방식은?",
    "en": "Neville discovers that the broom he bought for 50 Galleons is defective. Buying a new broom would clearly be the better choice, but he says: “The broom may be broken, but I learned how to repair a broom because of it, so perhaps it was actually a good thing.”\n\nWhat concept best describes this reasoning?",
    "choices": [
      "Confirmation Bias",
      "Sunk Cost Fallacy",
      "Sour Grapes",
      "Sweet Lemon"
    ],
    "enChoices": [
      "Confirmation Bias",
      "Sunk Cost Fallacy",
      "Sour Grapes",
      "Sweet Lemon"
    ],
    "answer": "D"
  },
  {
    "id": "Q8",
    "title": "마법의 역사",
    "enTitle": "History of Magic",
    "ko": "호그와트의 역사 시험에서 예상하지 못했던 사건이 출제되었습니다. 시험이 끝난 후 론은 말했습니다.\n“그 사건이 나올 줄 알았어. 문제를 보니까 너무 당연하더라.”\n\n하지만 시험 전에 론은 그 사건을 전혀 언급하지 않았습니다. 이 현상은?",
    "en": "An unexpected event appears on a Hogwarts History exam. After the exam, Ron says: “I knew that event would be on the test. It was obvious once I saw the question.”\n\nHowever, Ron had never mentioned the event before the exam. What phenomenon does this illustrate?",
    "choices": [
      "Confirmation Bias",
      "Hindsight Bias",
      "Overconfidence",
      "Availability Heuristic"
    ],
    "enChoices": [
      "Confirmation Bias",
      "Hindsight Bias",
      "Overconfidence",
      "Availability Heuristic"
    ],
    "answer": "B"
  },
  {
    "id": "Q9",
    "title": "퀴디치 경기: 가장 기억에 남는 사건",
    "enTitle": "Quidditch: The Most Memorable Incident",
    "ko": "지난달 퀴디치 경기에서 한 학생이 빗자루에서 떨어져 크게 다쳤습니다. 그 사건을 눈 앞에서 생생하게 목격한 이후, 헤르미온느는 **“퀴디치는 매우 위험한 스포츠이므로 사고가 자주 발생할 것”**이라고 생각하기 시작했습니다.\n\n이는 어떤 인지 편향과 관련이 있을까요?",
    "en": "During a Quidditch match last month, a student fell from a broomstick and was seriously injured. After witnessing the accident, Hermione begins to think: “Quidditch must be extremely dangerous, so serious accidents must happen frequently.”\n\nIf her judgment is mainly influenced by how vivid and easily remembered the accident is, which cognitive bias is involved?",
    "choices": [
      "Availability Heuristic (가용성 휴리스틱)",
      "Confirmation Bias (확증편향)",
      "Hindsight Bias (사후확신편향)",
      "Sunk Cost Fallacy (매몰비용 오류)"
    ],
    "enChoices": [
      "Availability Heuristic",
      "Confirmation Bias",
      "Hindsight Bias",
      "Sunk Cost Fallacy"
    ],
    "answer": "A"
  },
  {
    "id": "Q10",
    "title": "마법사의 돌을 지키는 시험",
    "enTitle": "Protecting the Philosopher’s Stone",
    "ko": "해리가 마법사의 돌을 찾으러 가기 전, 론이 말했습니다.\n“우리가 돌을 찾으면 덤블도어가 반드시 우리를 칭찬해 주실 거야. 분명 좋은 생각이야.”\n\n헤르미온느가 물었습니다.\n“그리핀도르의 기숙사 점수가 100점 깎이더라도 그렇게 말할 수 있어?”\n\n론은 갑자기 대답을 망설였습니다. 사실 그는 덤블도어가 어떻게 반응할지에 대한 확실한 근거가 거의 없었습니다.\n\n다음 중 론의 반응을 가장 잘 설명하는 것은 무엇일까요?",
    "en": "Before Harry goes after the Philosopher’s Stone, Ron says: “If we find the Stone, Dumbledore will definitely praise us. It’s obviously a good idea.”\n\nHermione asks: “Would you still say that if Gryffindor lost 100 House Points because of it?”\n\nRon suddenly hesitates. In reality, he has very little evidence about how Dumbledore would actually respond.\n\nWhich best explains Ron’s reaction?",
    "choices": [
      "실제 이해관계가 생기자 자신의 실제 확신 수준을 더 정확하게 평가하기 시작했다.",
      "내기를 제안받으면 사람은 항상 자신의 첫 번째 판단을 바꾸게 된다.",
      "론은 덤블도어를 신뢰하지 않았기 때문에 대답을 망설였다.",
      "다른 사람에게 자신의 의견을 말하는 것은 합리적인 판단을 방해한다."
    ],
    "enChoices": [
      "Once real stakes were involved, he began to assess his actual level of confidence more accurately.",
      "People always change their initial judgment when they are asked to make a bet.",
      "Ron hesitated because he did not trust Dumbledore.",
      "Expressing an opinion to someone else prevents rational judgment."
    ],
    "answer": "A"
  }
];

export const INTRO = {
  ko: "<h2>✨ 호그와트 마법학교 입학을 진심으로 환영합니다! ✨</h2><p>호그와트에 도착한 신입생, 환영합니다! 🦉💌</p><h3>🏆 [특별 안내] 영예의 ‘기숙사 컵(House Cup)’이란?</h3><p>호그와트에서는 매 학년이 진행되는 한 해 동안, 네 기숙사(그리핀도르, 래번클로, 후플푸프, 슬리데린)는 학교생활을 통해 기숙사 점수(House Points)를 쌓으며 선의의 경쟁을 펼칩니다! 🌟</p><p>학기 말에 가장 많은 점수를 적립한 기숙사가 호그와트의 최고 영예인 <strong>‘기숙사 컵(House Cup)’ 트로피</strong>를 차지하고, 연회장을 자신의 기숙사 상징 색으로 물들이는 영광을 누리게 됩니다. 🏆✨</p><p>지금부터 여러분의 선택은 <strong>올해 기숙사 컵의 승패를 가르는 결정적인 대항전</strong>으로 이어집니다! 💯🔥</p><h3>⚡ 대회 룰: 리스크 &amp; 리턴 (Risk &amp; Return)</h3><p>여러분이 제출하는 선택에 따라 기숙사 점수가 실시간으로 변동됩니다!</p><ul><li><strong>95% 확신</strong>으로 문제를 맞히면 기숙사에 거대한 점수를 안겨줍니다! 🌟</li><li>하지만 섣불리 95%를 확신했다가 틀리면 <strong>기숙사 점수가 대폭 감점</strong>됩니다! 😱💥</li><li>무작정 찌르는 자만심(대변인 모드)은 버리고, 자신의 진짜 정답 확률을 정밀하게 추정하는 정찰병 마음가짐(Scout Mindset)으로 여러분의 기숙사를 우승으로 이끄세요! ⚔️🛡️</li></ul>",
  en: "<h2>✨ A warm welcome to Hogwarts School of Witchcraft and Wizardry! ✨</h2><p>Welcome, new students, to Hogwarts! 🦉💌</p><h3>🏆 A special note about the House Cup</h3><p>Throughout the school year, the four Houses—Gryffindor, Ravenclaw, Hufflepuff, and Slytherin—compete in good spirits as they earn House Points through school life. 🌟</p><p>At the end of term, the House with the most points wins the <strong>House Cup</strong>, Hogwarts' highest honor, and has the Great Hall bathed in its colors. 🏆✨</p><p>Your choices will help decide this year's House Cup! 💯🔥</p><h3>⚡ Risk &amp; Return</h3><p>House Points change with every answer you submit.</p><ul><li>Get it right at <strong>95% confidence</strong> and earn a huge number of points! 🌟</li><li>Get it wrong after choosing 95% and your House loses a lot of points! 😱💥</li><li>Set aside overconfidence and use a Scout Mindset to estimate your real chance of being right. ⚔️🛡️</li></ul>"
};
