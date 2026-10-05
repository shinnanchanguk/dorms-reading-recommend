/* 연습용 가짜 데이터. 실제 도름스가 건네는 모양과 같아요(공개 정보만). 책 제목은 모두 예시예요. */
window.FIXTURES = {
  book: { id: "demo-reading", title: "독서 교육", subtitle: "교과마다 책을 읽고, 생각을 나누는 수업", question: "책으로 어떤 수업을 함께 만들어 갈까요?", intent: "", callNumber: "300-002", ownerName: "예시 운영자" },
  themes: {
    light: { "--paper": "#F7F8F4", "--ink": "#242824", "--ink-light": "#5C635D", "--border-light": "#C4C9C1", "--border-dark": "#8A9188", "--book-paper": "#F7F8F4", "--book-body-ink": "#242824", "--book-muted": "#5C635D", "--book-rule": "#C4C9C1", "--book-cta": "#F9A16C" },
    dark: { "--paper": "#1D211F", "--ink": "#EDF1EA", "--ink-light": "#ABB6AB", "--border-light": "#414A43", "--border-dark": "#6B766C", "--book-paper": "#1D211F", "--book-body-ink": "#EDF1EA", "--book-muted": "#ABB6AB", "--book-rule": "#414A43", "--book-cta": "#F9A16C" },
  },
  indexes: [
    { key: "cover", label: "앱과 자료", module: "cover", sortOrder: 0, viewRole: "anyone", writeRole: "teacher", config: {} },
    { key: "recommend", label: "학생 도서 추천", module: "data", sortOrder: 5, viewRole: "anyone", writeRole: "operator", config: {} },
    { key: "thoughts", label: "생각 나누기", module: "essays", sortOrder: 10, viewRole: "anyone", writeRole: "teacher", config: {} },
    { key: "contributions", label: "기여도", module: "people", sortOrder: 20, viewRole: "anyone", writeRole: "operator", config: {} },
  ],
  /* 데이터 상자(색인 이름표 → 모음 이름 → 줄 목록). 값은 실제 도름스와 같은 모양으로 담는다. */
  data: {
    recommend: {
      books: [
        { key: "b-sample-1", value: { subject: "국어", title: "예시 책 1", author: "예시 지은이", level: "중학생", reason: "예시 추천 이유: 인물의 선택을 따라가며 토론하기 좋아요.", link: "", order: 1 } },
        { key: "b-sample-2", value: { subject: "국어", title: "예시 책 2", author: "예시 지은이", level: "고1", reason: "예시 추천 이유: 짧은 글이 이어져 아침 독서에 맞아요.", link: "https://example.org/book-2", order: 2 } },
        { key: "b-sample-3", value: { subject: "과학", title: "예시 책 3", author: "예시 지은이", level: "초등 고학년", reason: "예시 추천 이유: 실험과 함께 읽으면 좋아요.", link: "", order: 3 } },
        { key: "b-sample-4", value: { subject: "공통", title: "예시 책 4", author: "예시 지은이", level: "모든 학년", reason: "예시 추천 이유: 학급 독서 모임 첫 책으로 권해요.", link: "", order: 4 } },
      ],
    },
  },
};
