import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { auth } from "../config/firebase";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TabParamList } from "../navigation/types";
import StoreKitService from "../services/StoreKit";
import UpgradePrompt from "../components/UpgradePrompt";

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, "Quiz">;
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

export interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

const QuizScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] =
    useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState<
    SubscriptionOption[]
  >([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [subscription, setSubscription] = useState<{status: string} | null>(null);

  // Extract default parameters from route.params
  const { testType = "CogAT_Verbal", grade = "1" } = route.params || {};

  // Load quiz questions on mount
  useEffect(() => {
    loadQuestions();
    checkSubscriptionStatus();
  }, []);

  // Check subscription status
  const checkSubscriptionStatus = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${userId}`
      );
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      const data = await response.json();
      setSubscription(data);
      console.log("Subscription status:", data.status);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  // Initialize IAP products for subscription
  useEffect(() => {
    const initializeStoreKit = async () => {
      try {
        const storeKit = StoreKitService.getInstance();
        await storeKit.initialize();
        const products = storeKit.getProducts();
        const options = products.map((product) => ({
          sku: product.productId,
          title: product.title,
          price: product.localizedPrice,
          period: product.productId.includes("yearly") ? "year" : "month",
          description: product.description,
        }));
        setSubscriptionOptions(options);
      } catch (error) {
        console.error("Failed to initialize StoreKit:", error);
      }
    };

    initializeStoreKit();
  }, []);

  const loadQuestions = async () => {
    try {
      console.log("Using testType:", testType, "and grade:", grade);
      if (!testType || !grade) {
        console.warn("Missing required parameters:", { testType, grade });
        return (
          <View style={styles.loadingContainer}>
            <Text>Please select a test from the Dashboard.</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Dashboard")}>
              <Text style={styles.link}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        );
      }
      const response = await fetch(
        `https://smart-ai-tutor.com/api/questions/${testType}/${grade}?t=${Date.now()}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      const data = await response.json();
      setQuestions(data);
      // Initialize the answers array based on the number of questions
      setUserAnswers(new Array(data.length).fill(null));
      setLoading(false);
    } catch (error) {
      console.error("Error loading questions:", error);
      Alert.alert("Error", "Failed to load questions. Please try again.");
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
    setUserAnswers(newAnswers);
    setSelectedAnswer(answer);
  };

  const handleNext = async () => {
    if (selectedAnswer === null) {
      Alert.alert("Please select an answer");
      return;
    }

    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore((prev) => prev + 1);
    }

    // Save answer for current question
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestion] = selectedAnswer;
    setUserAnswers(newUserAnswers);

    // For every 6th question, show the subscription upgrade prompt
    if (currentQuestion < questions.length - 1) {
      if ((currentQuestion + 1) % 6 === 0 && subscription?.status !== "premium") {
        setSubscriptionModalVisible(true);
        return;
      }
      // Otherwise, proceed to the next question
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(newUserAnswers[currentQuestion + 1] || null);
    } else {
      // Quiz is complete
      setQuizComplete(true);
      await saveQuizResults();
    }
  };

  const saveQuizResults = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const { testType, grade } = route.params;
      const finalScore =
        ((score +
          (selectedAnswer === questions[currentQuestion].correctAnswer
            ? 1
            : 0)) /
          questions.length) *
        100;
      await fetch("https://smart-ai-tutor.com/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          testType,
          grade: grade === "K" ? 0 : parseInt(grade),
          questionsAttempted: questions.length,
          correctAnswers:
            score +
            (selectedAnswer === questions[currentQuestion].correctAnswer
              ? 1
              : 0),
          lastAttempted: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Error saving quiz results:", error);
      Alert.alert("Error", "Failed to save quiz results");
    }
  };

  const handleSubscription = async (sku: string) => {
    setLoadingSubscription(true);
    try {
      const storeKit = StoreKitService.getInstance();
      const result = await storeKit.purchaseSubscription(sku);
      
      if (result.success) {
        // On successful purchase, close the modal and proceed to the next question
        setSubscriptionModalVisible(false);
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
        Alert.alert(
          "Success",
          "Thank you for subscribing! Please sign out and log in again.",
        );
      } else if (result.cancelled) {
        // User cancelled the purchase - just close the modal without error
        console.log("Purchase cancelled by user");
        setSubscriptionModalVisible(false);
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
      } else if (result.error) {
        // Instead of showing error, verify subscription status via API
        console.log("Purchase had error, verifying subscription status:", result.error);
        await verifySubscriptionStatusAfterError();
      }
    } catch (error) {
      // Instead of showing error, verify subscription status via API
      console.log("Purchase threw exception, verifying subscription status:", error);
      await verifySubscriptionStatusAfterError();
      setSubscriptionModalVisible(false);
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
    } finally {
      setLoadingSubscription(false);
    }
  };

  // New helper function to verify subscription status after error
  const verifySubscriptionStatusAfterError = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log("No user ID found, treating as cancellation");
        setSubscriptionModalVisible(false);
        return;
      }
      
      // Refresh subscription status from server
      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${userId}`
      );
      
      if (!response.ok) {
        console.log("Failed to verify subscription status, treating as cancellation");
        setSubscriptionModalVisible(false);
        return;
      }
      
      const data = await response.json();
      setSubscription(data);
      
      if (data.status === "premium") {
        // User is subscribed! Transaction succeeded despite the error
        console.log("User is subscribed despite IAP error, proceeding as success");
        setSubscriptionModalVisible(false);
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
        Alert.alert(
          "Success",
          "Thank you for subscribing! Please sign out and log in again.",
        );
      } else {
        // Not subscribed, treat as cancellation
        console.log("User not subscribed after IAP flow, treating as cancellation");
        setSubscriptionModalVisible(false);
      }
    } catch (error) {
      console.error("Error verifying subscription after error:", error);
      // Silently handle error, treat as cancellation
      setSubscriptionModalVisible(false);
    }
  };

  const handleRedoTest = () => {
    setCurrentQuestion(0);
    setUserAnswers(new Array(questions.length).fill(null));
    setScore(0);
    setQuizComplete(false);
    setSelectedAnswer(null);
  };

  const handleRedoWrong = async () => {
    try {
      const response = await fetch(
        "https://smart-ai-tutor.com/api/subscription/" + auth.currentUser?.uid,
      );
      const subscriptionData = await response.json();
      console.log("subscription status: ", subscriptionData.status);
      if (subscriptionData.status !== "premium") {
        // Show upgrade prompt for free users
        setSubscriptionModalVisible(true);
        console.log("Upgrade prompt should appear for Redo Wrong");
        return;
      }
      // If premium, redo wrong questions directly
      const wrongOnes = questions.filter(
        (_, index) => userAnswers[index] !== questions[index].correctAnswer,
      );
      setQuestions(wrongOnes);
      setCurrentQuestion(0);
      setUserAnswers(new Array(wrongOnes.length).fill(null));
      setScore(0);
      setQuizComplete(false);
      setSelectedAnswer(null);
    } catch (error) {
      console.error("Error checking subscription:", error);
      setSubscriptionModalVisible(true);
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

  // Render quiz complete UI or in-quiz UI
  const renderContent = () => {
    if (quizComplete) {
      const totalCorrect = userAnswers.reduce(
        (acc, answer, index) =>
          acc + (answer === questions[index].correctAnswer ? 1 : 0),
        0,
      );
      const finalScore = (totalCorrect / questions.length) * 100;
      const wrongQuestions = questions.filter(
        (_, index) => userAnswers[index] !== questions[index].correctAnswer,
      );
      return (
        <ScrollView style={styles.container}>
          <Text style={styles.title}>Quiz Complete!</Text>
          <Text style={styles.scoreText}>
            Your Score: {Math.round(finalScore)}%
          </Text>
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
              <Text
                style={[
                  styles.answerText,
                  {
                    color:
                      userAnswers[index] === q.correctAnswer
                        ? "#4CAF50"
                        : "#f44336",
                  },
                ]}
              >
                Your answer: {userAnswers[index]}
              </Text>
              <Text style={[styles.answerText, { color: "#4CAF50" }]}>
                Correct answer: {q.correctAnswer}
              </Text>
              {userAnswers[index] !== q.correctAnswer && q.explanation && (
                <>
                  {subscriptionModalVisible && (
                    <UpgradePrompt
                      visible={subscriptionModalVisible}
                      onClose={() => setSubscriptionModalVisible(false)}
                      subscriptionOptions={subscriptionOptions}
                      onSubscribe={handleSubscription}
                      loadingSubscription={loadingSubscription}
                    />
                  )}
                  
                  {/* For premium users, show explanation directly */}
                  {auth.currentUser && (
                    <>
                      {subscription?.status === "premium" ? (
                        <View style={styles.explanationContainer}>
                          <Text style={styles.explanationTitle}>Explanation:</Text>
                          <Text style={styles.explanationText}>{q.explanation}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setSubscriptionModalVisible(true)}
                          style={styles.showExplanationLink}
                        >
                          <Text style={styles.linkText}>Show explanation</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          ))}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonThird]}
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Dashboard" }],
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
              disabled={
                questions.filter(
                  (_, index) =>
                    userAnswers[index] !== questions[index].correctAnswer,
                ).length === 0
              }
            >
              <Text style={styles.buttonText}>
                Redo Wrong (
                {
                  questions.filter(
                    (_, index) =>
                      userAnswers[index] !== questions[index].correctAnswer,
                  ).length
                }
                )
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    } else {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentQuestion + 1} of {questions.length} - {testType} (Grade:{" "}
              {grade})
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
                <Text
                  style={[
                    styles.optionText,
                    selectedAnswer === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={[
                  styles.button,
                  !selectedAnswer && styles.buttonDisabled,
                ]}
                onPress={handleNext}
                disabled={!selectedAnswer}
              >
                <Text style={styles.buttonText}>
                  {currentQuestion === questions.length - 1 ? "Finish" : "Next"}
                </Text>
              </TouchableOpacity>
              {currentQuestion > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setCurrentQuestion(currentQuestion - 1);
                    setSelectedAnswer(userAnswers[currentQuestion - 1] || null);
                  }}
                >
                  <Text style={styles.backLink}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      );
    }
  };

  return (
    <>
      {/* UpgradePrompt is now rendered regardless of quiz state */}
      <UpgradePrompt
        visible={subscriptionModalVisible}
        onClose={() => {
          setSubscriptionModalVisible(false);
          // For in-quiz scenario, move to the next question if applicable.
          if (!quizComplete && currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
          }
        }}
        subscriptionOptions={subscriptionOptions}
        onSubscribe={handleSubscription}
        loadingSubscription={loadingSubscription}
      />
      {renderContent()}
    </>
  );
};

const styles = StyleSheet.create({
  navigationButtons: {
    alignItems: "center",
    marginTop: 20,
  },
  backLink: {
    color: "#666",
    marginTop: 10,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  buttonThird: {
    flex: 1,
    marginHorizontal: 5,
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    padding: 20,
    backgroundColor: "white",
  },
  progressText: {
    fontSize: 16,
    color: "#666",
  },
  questionContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
  },
  questionImage: {
    width: "100%",
    height: 200,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectedOption: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedOptionText: {
    color: "white",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: "100%",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  resultCard: {
    backgroundColor: "white",
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: "#000",
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
  explanationContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#4CAF50",
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  link: {
    color: "#007AFF",
    marginTop: 10,
    textDecorationLine: "underline",
  },
  showExplanationLink: {
    marginTop: 10,
    padding: 8,
  },
  linkText: {
    color: "#007AFF",
    fontSize: 16,
    textDecorationLine: "underline",
  },
});

export default QuizScreen;
/* import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { auth } from "../config/firebase";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TabParamList } from "../navigation/types";
import StoreKitService from "../services/StoreKit";
import UpgradePrompt from "../components/UpgradePrompt";

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, "Quiz">;
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

export interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

const QuizScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [subscriptionModalVisible, setSubscriptionModalVisible] =
    useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState<
    SubscriptionOption[]
  >([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [subscription, setSubscription] = useState<{status: string} | null>(null);

  // Extract default parameters from route.params
  const { testType = "CogAT_Verbal", grade = "1" } = route.params || {};

  // Load quiz questions on mount
  useEffect(() => {
    loadQuestions();
    checkSubscriptionStatus();
  }, []);

  // Check subscription status
  const checkSubscriptionStatus = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${userId}`
      );
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      const data = await response.json();
      setSubscription(data);
      console.log("Subscription status:", data.status);
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  // Initialize IAP products for subscription
  useEffect(() => {
    const initializeStoreKit = async () => {
      try {
        const storeKit = StoreKitService.getInstance();
        await storeKit.initialize();
        const products = storeKit.getProducts();
        const options = products.map((product) => ({
          sku: product.productId,
          title: product.title,
          price: product.localizedPrice,
          period: product.productId.includes("yearly") ? "year" : "month",
          description: product.description,
        }));
        setSubscriptionOptions(options);
      } catch (error) {
        console.error("Failed to initialize StoreKit:", error);
      }
    };

    initializeStoreKit();
  }, []);

  const loadQuestions = async () => {
    try {
      console.log("Using testType:", testType, "and grade:", grade);
      if (!testType || !grade) {
        console.warn("Missing required parameters:", { testType, grade });
        return (
          <View style={styles.loadingContainer}>
            <Text>Please select a test from the Dashboard.</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Dashboard")}>
              <Text style={styles.link}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        );
      }
      const response = await fetch(
        `https://smart-ai-tutor.com/api/questions/${testType}/${grade}?t=${Date.now()}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch questions");
      }
      const data = await response.json();
      setQuestions(data);
      // Initialize the answers array based on the number of questions
      setUserAnswers(new Array(data.length).fill(null));
      setLoading(false);
    } catch (error) {
      console.error("Error loading questions:", error);
      Alert.alert("Error", "Failed to load questions. Please try again.");
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = answer;
    setUserAnswers(newAnswers);
    setSelectedAnswer(answer);
  };

  const handleNext = async () => {
    if (selectedAnswer === null) {
      Alert.alert("Please select an answer");
      return;
    }

    if (selectedAnswer === questions[currentQuestion].correctAnswer) {
      setScore((prev) => prev + 1);
    }

    // Save answer for current question
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestion] = selectedAnswer;
    setUserAnswers(newUserAnswers);

    // For every 6th question, show the subscription upgrade prompt
    if (currentQuestion < questions.length - 1) {
      if ((currentQuestion + 1) % 6 === 0) {
        setSubscriptionModalVisible(true);
        return;
      }
      // Otherwise, proceed to the next question
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(newUserAnswers[currentQuestion + 1] || null);
    } else {
      // Quiz is complete
      setQuizComplete(true);
      await saveQuizResults();
    }
  };

  const saveQuizResults = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const { testType, grade } = route.params;
      const finalScore =
        ((score +
          (selectedAnswer === questions[currentQuestion].correctAnswer
            ? 1
            : 0)) /
          questions.length) *
        100;
      await fetch("https://smart-ai-tutor.com/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          testType,
          grade: grade === "K" ? 0 : parseInt(grade),
          questionsAttempted: questions.length,
          correctAnswers:
            score +
            (selectedAnswer === questions[currentQuestion].correctAnswer
              ? 1
              : 0),
          lastAttempted: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Error saving quiz results:", error);
      Alert.alert("Error", "Failed to save quiz results");
    }
  };

  const handleSubscription = async (sku: string) => {
    setLoadingSubscription(true);
    try {
      const storeKit = StoreKitService.getInstance();
      await storeKit.purchaseSubscription(sku);
      // On successful purchase, close the modal and proceed to the next question
      setSubscriptionModalVisible(false);
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
      Alert.alert(
        "Success",
        "Thank you for subscribing! Please sign out and log in again.",
      );
    } catch (error) {
      Alert.alert("Error", "Failed to complete purchase. Please try again.");
      console.error("Subscription error:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleRedoTest = () => {
    setCurrentQuestion(0);
    setUserAnswers(new Array(questions.length).fill(null));
    setScore(0);
    setQuizComplete(false);
    setSelectedAnswer(null);
  };

  const handleRedoWrong = async () => {
    try {
      const response = await fetch(
        "https://smart-ai-tutor.com/api/subscription/" + auth.currentUser?.uid,
      );
      const subscriptionData = await response.json();
      console.log("subscription status: ", subscriptionData.status);
      if (subscriptionData.status !== "premium") {
        // Show upgrade prompt for free users
        setSubscriptionModalVisible(true);
        console.log("Upgrade prompt should appear for Redo Wrong");
        return;
      }
      // If premium, redo wrong questions directly
      const wrongOnes = questions.filter(
        (_, index) => userAnswers[index] !== questions[index].correctAnswer,
      );
      setQuestions(wrongOnes);
      setCurrentQuestion(0);
      setUserAnswers(new Array(wrongOnes.length).fill(null));
      setScore(0);
      setQuizComplete(false);
      setSelectedAnswer(null);
    } catch (error) {
      console.error("Error checking subscription:", error);
      setSubscriptionModalVisible(true);
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

  // Render quiz complete UI or in-quiz UI
  const renderContent = () => {
    if (quizComplete) {
      const totalCorrect = userAnswers.reduce(
        (acc, answer, index) =>
          acc + (answer === questions[index].correctAnswer ? 1 : 0),
        0,
      );
      const finalScore = (totalCorrect / questions.length) * 100;
      const wrongQuestions = questions.filter(
        (_, index) => userAnswers[index] !== questions[index].correctAnswer,
      );
      return (
        <ScrollView style={styles.container}>
          <Text style={styles.title}>Quiz Complete!</Text>
          <Text style={styles.scoreText}>
            Your Score: {Math.round(finalScore)}%
          </Text>
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
              <Text
                style={[
                  styles.answerText,
                  {
                    color:
                      userAnswers[index] === q.correctAnswer
                        ? "#4CAF50"
                        : "#f44336",
                  },
                ]}
              >
                Your answer: {userAnswers[index]}
              </Text>
              <Text style={[styles.answerText, { color: "#4CAF50" }]}>
                Correct answer: {q.correctAnswer}
              </Text>
              {userAnswers[index] !== q.correctAnswer && q.explanation && (
                <>
                  {subscriptionModalVisible && (
                    <UpgradePrompt
                      visible={subscriptionModalVisible}
                      onClose={() => setSubscriptionModalVisible(false)}
                      subscriptionOptions={subscriptionOptions}
                      onSubscribe={handleSubscription}
                      loadingSubscription={loadingSubscription}
                    />
                  )}
                  
                  
                  {auth.currentUser && (
                    <>
                      {subscription?.status === "premium" ? (
                        <View style={styles.explanationContainer}>
                          <Text style={styles.explanationTitle}>Explanation:</Text>
                          <Text style={styles.explanationText}>{q.explanation}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setSubscriptionModalVisible(true)}
                          style={styles.showExplanationLink}
                        >
                          <Text style={styles.linkText}>Show explanation</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          ))}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonThird]}
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Dashboard" }],
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
              disabled={
                questions.filter(
                  (_, index) =>
                    userAnswers[index] !== questions[index].correctAnswer,
                ).length === 0
              }
            >
              <Text style={styles.buttonText}>
                Redo Wrong (
                {
                  questions.filter(
                    (_, index) =>
                      userAnswers[index] !== questions[index].correctAnswer,
                  ).length
                }
                )
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    } else {
      return (
        <ScrollView style={styles.container}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentQuestion + 1} of {questions.length} - {testType} (Grade:{" "}
              {grade})
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
                <Text
                  style={[
                    styles.optionText,
                    selectedAnswer === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={[
                  styles.button,
                  !selectedAnswer && styles.buttonDisabled,
                ]}
                onPress={handleNext}
                disabled={!selectedAnswer}
              >
                <Text style={styles.buttonText}>
                  {currentQuestion === questions.length - 1 ? "Finish" : "Next"}
                </Text>
              </TouchableOpacity>
              {currentQuestion > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setCurrentQuestion(currentQuestion - 1);
                    setSelectedAnswer(userAnswers[currentQuestion - 1] || null);
                  }}
                >
                  <Text style={styles.backLink}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      );
    }
  };

  return (
    <>
      
      <UpgradePrompt
        visible={subscriptionModalVisible}
        onClose={() => {
          setSubscriptionModalVisible(false);
          // For in-quiz scenario, move to the next question if applicable.
          if (!quizComplete && currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(userAnswers[currentQuestion + 1] || null);
          }
        }}
        subscriptionOptions={subscriptionOptions}
        onSubscribe={handleSubscription}
        loadingSubscription={loadingSubscription}
      />
      {renderContent()}
    </>
  );
};

const styles = StyleSheet.create({
  navigationButtons: {
    alignItems: "center",
    marginTop: 20,
  },
  backLink: {
    color: "#666",
    marginTop: 10,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  buttonThird: {
    flex: 1,
    marginHorizontal: 5,
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    padding: 20,
    backgroundColor: "white",
  },
  progressText: {
    fontSize: 16,
    color: "#666",
  },
  questionContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
  },
  questionImage: {
    width: "100%",
    height: 200,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectedOption: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
  },
  selectedOptionText: {
    color: "white",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: "100%",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 30,
  },
  resultCard: {
    backgroundColor: "white",
    padding: 20,
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    shadowColor: "#000",
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
  explanationContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#4CAF50",
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  link: {
    color: "#007AFF",
    marginTop: 10,
    textDecorationLine: "underline",
  },
  showExplanationLink: {
    marginTop: 10,
    padding: 8,
  },
  linkText: {
    color: "#007AFF",
    fontSize: 16,
    textDecorationLine: "underline",
  },
});

export default QuizScreen; */

