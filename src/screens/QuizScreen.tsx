/*
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { auth } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, 'Quiz'>;
  route: {
    params: {
      testType: string;
      grade: string;
    };
  };
};

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  imageUrl?: string;
}

const QuizScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const { testType, grade } = route.params;
      const response = await fetch(
        `https://smart-ai-tutor.com/api/questions/${testType}/${grade}?t=${Date.now()}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions. Please try again.');
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = async () => {
    if (selectedAnswer === null) {
      Alert.alert('Please select an answer');
      return;
    }

    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }

    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestion] = selectedAnswer;
    setUserAnswers(newUserAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setQuizComplete(true);
      await saveQuizResults();
    }
  };

  const saveQuizResults = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const { testType, grade } = route.params;
      const finalScore = ((score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0)) / questions.length) * 100;

      await fetch('https://smart-ai-tutor.com/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          testType,
          grade: grade === 'K' ? 0 : parseInt(grade),
          questionsAttempted: questions.length,
          correctAnswers: score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0),
          lastAttempted: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error saving quiz results:', error);
      Alert.alert('Error', 'Failed to save quiz results');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No Questions Available</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (quizComplete) {
    const finalScore = ((score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0)) / questions.length) * 100;
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Quiz Complete!</Text>
        <Text style={styles.scoreText}>Your Score: {Math.round(finalScore)}%</Text>
        
        {questions.map((q, index) => (
          <View key={index} style={styles.resultCard}>
            <Text style={styles.questionText}>{q.question}</Text>
            {q.imageUrl && (
              <Image 
                source={{ uri: q.imageUrl }}
                style={styles.questionImage}
                resizeMode="contain"
              />
            )}
            <Text style={[
              styles.answerText,
              { color: userAnswers[index] === q.correctAnswer ? '#4CAF50' : '#f44336' }
            ]}>
              Your answer: {userAnswers[index]}
            </Text>
            <Text style={[styles.answerText, { color: '#4CAF50' }]}>
              Correct answer: {q.correctAnswer}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          style={styles.button}
          //onPress={() => navigation.navigate('Dashboard')}
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            });
          }}
        >
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Question {currentQuestion + 1} of {questions.length}
        </Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>
          {questions[currentQuestion]?.question}
        </Text>

        {questions[currentQuestion]?.imageUrl && (
          <Image
            source={{ uri: questions[currentQuestion].imageUrl }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        )}

        {questions[currentQuestion]?.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              selectedAnswer === option && styles.selectedOption,
            ]}
            onPress={() => handleAnswer(option)}
          >
            <Text style={[
              styles.optionText,
              selectedAnswer === option && styles.selectedOptionText,
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, !selectedAnswer && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!selectedAnswer}
        >
          <Text style={styles.buttonText}>
            {currentQuestion === questions.length - 1 ? 'Finish' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    padding: 20,
    backgroundColor: 'white',
  },
  progressText: {
    fontSize: 16,
    color: '#666',
  },
  questionContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  questionImage: {
    width: '100%',
    height: 200,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: 'white',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 30,
  },
  resultCard: {
    backgroundColor: 'white',
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  answerText: {
    fontSize: 16,
    marginTop: 10,
  },
});

export default QuizScreen;
*/


import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image
} from 'react-native';
import { auth } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, 'Quiz'>;
  route: {
    params: {
      testType: string;
      grade: string;
    };
  };
};

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  imageUrl?: string;
}

const QuizScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const { testType, grade } = route.params;
      const response = await fetch(
        `https://smart-ai-tutor.com/api/questions/${testType}/${grade}?t=${Date.now()}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      const data = await response.json();
      setQuestions(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions. Please try again.');
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const handleNext = async () => {
    if (selectedAnswer === null) {
      Alert.alert('Please select an answer');
      return;
    }

    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore(score + 1);
    }

    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestion] = selectedAnswer;
    setUserAnswers(newUserAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setQuizComplete(true);
      await saveQuizResults();
    }
  };

  const saveQuizResults = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const { testType, grade } = route.params;
      const finalScore = ((score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0)) / questions.length) * 100;

      await fetch('https://smart-ai-tutor.com/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          testType,
          grade: grade === 'K' ? 0 : parseInt(grade),
          questionsAttempted: questions.length,
          correctAnswers: score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0),
          lastAttempted: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error saving quiz results:', error);
      Alert.alert('Error', 'Failed to save quiz results');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No Questions Available</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (quizComplete) {
    const totalCorrect = userAnswers.reduce((acc, answer, index) => 
    acc + (answer === questions[index].correctAnswer ? 1 : 0), 0
  );
  const finalScore = (totalCorrect / questions.length) * 100;
    const wrongQuestions = questions.filter((_, index) => userAnswers[index] !== questions[index].correctAnswer);

    const handleRedoTest = () => {
      setCurrentQuestion(0);
      setUserAnswers([]);
      setScore(0);
      setQuizComplete(false);
    };

    const handleRedoWrong = () => {
      const wrongOnes = questions.filter((_, index) => userAnswers[index] !== questions[index].correctAnswer);
      setQuestions(wrongOnes);
      setCurrentQuestion(0);
      setUserAnswers([]);
      setScore(0);
      setQuizComplete(false);
    };

    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Quiz Complete!</Text>
        <Text style={styles.scoreText}>Your Score: {Math.round(finalScore)}%</Text>
        
        {questions.map((q, index) => (
          <View key={index} style={styles.resultCard}>
            <Text style={styles.questionText}>{q.question}</Text>
            {q.imageUrl && (
              <Image 
                source={{ uri: q.imageUrl }}
                style={styles.questionImage}
                resizeMode="contain"
              />
            )}
            <Text style={[
              styles.answerText,
              { color: userAnswers[index] === q.correctAnswer ? '#4CAF50' : '#f44336' }
            ]}>
              Your answer: {userAnswers[index]}
            </Text>
            <Text style={[styles.answerText, { color: '#4CAF50' }]}>
              Correct answer: {q.correctAnswer}
            </Text>
          </View>
        ))}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonThird]}
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Dashboard' }],
              });
            }}
          >
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonThird]}
            onPress={handleRedoTest}
          >
            <Text style={styles.buttonText}>Redo All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonThird]}
            onPress={handleRedoWrong}
            disabled={wrongQuestions.length === 0}
          >
            <Text style={styles.buttonText}>
              Redo Wrong ({wrongQuestions.length})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Question {currentQuestion + 1} of {questions.length}
        </Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>
          {questions[currentQuestion]?.question}
        </Text>

        {questions[currentQuestion]?.imageUrl && (
          <Image
            source={{ uri: questions[currentQuestion].imageUrl }}
            style={styles.questionImage}
            resizeMode="contain"
          />
        )}

        {questions[currentQuestion]?.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              selectedAnswer === option && styles.selectedOption,
            ]}
            onPress={() => handleAnswer(option)}
          >
            <Text style={[
              styles.optionText,
              selectedAnswer === option && styles.selectedOptionText,
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, !selectedAnswer && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!selectedAnswer}
        >
          <Text style={styles.buttonText}>
            {currentQuestion === questions.length - 1 ? 'Finish' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  buttonThird: {
    flex: 1,
    marginHorizontal: 5,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    padding: 20,
    backgroundColor: 'white',
  },
  progressText: {
    fontSize: 16,
    color: '#666',
  },
  questionContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  questionImage: {
    width: '100%',
    height: 200,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: 'white',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 30,
  },
  resultCard: {
    backgroundColor: 'white',
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  answerText: {
    fontSize: 16,
    marginTop: 10,
  },
});

export default QuizScreen;

