export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  MainApp: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Quiz: undefined;
  Profile: undefined;
};

export type QuizStackParamList = {
  QuizList: undefined;
  QuizSession: {
    quizId: string;
    grade: string;
    subject: string;
  };
  QuizResult: {
    score: number;
    total: number;
  };
};

// Add this type to handle nested navigation
export type NavigatorParamList = RootStackParamList & TabParamList;