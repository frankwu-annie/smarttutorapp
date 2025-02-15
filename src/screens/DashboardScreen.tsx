/* import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabParamList } from '../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, 'Dashboard'>;
};

type Subject = 'Math' | 'Reading' | 'Science';
type Grade = 'K' | '1' | '2' | '3' | '4' | '5';

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [userGrade, setUserGrade] = useState<Grade>('K');
  const [progress, setProgress] = useState<{
    totalQuizzes: number;
    completedQuizzes: number;
    averageScore: number;
  }>({
    totalQuizzes: 0,
    completedQuizzes: 0,
    averageScore: 0,
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      setUserGrade(userData?.grade || 'K');

      const completedQuizzes = userData?.completedQuizzes || [];
      const averageScore = completedQuizzes.reduce((acc, quiz) => acc + quiz.score, 0) / 
                          (completedQuizzes.length || 1);

      setProgress({
        totalQuizzes: 15, // Placeholder - should be fetched from your quiz database
        completedQuizzes: completedQuizzes.length,
        averageScore,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const subjects: Subject[] = ['Math', 'Reading', 'Science'];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Welcome Back!</Text>
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Your Progress</Text>
        <View style={styles.progressStats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{progress.completedQuizzes}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{Math.round(progress.averageScore)}%</Text>
            <Text style={styles.statLabel}>Avg. Score</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Available Tests</Text>
      {subjects.map((subject) => (
        <TouchableOpacity
          key={subject}
          style={styles.subjectCard}
          onPress={() => navigation.navigate('Quiz')}
        >
          <Text style={styles.subjectTitle}>{subject}</Text>
          <Text style={styles.subjectGrade}>Grade {userGrade}</Text>
        </TouchableOpacity>
      ))}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
  progressCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    color: '#666',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    padding: 20,
    paddingBottom: 10,
  },
  subjectCard: {
    backgroundColor: 'white',
    margin: 15,
    marginVertical: 8,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  subjectGrade: {
    color: '#666',
    marginTop: 5,
  },
});

export default DashboardScreen;
 */


import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { auth } from '../config/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TabParamList } from '../navigation/types';
import { useQuery } from '@tanstack/react-query';

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, 'Dashboard'>;
};

const TEST_TYPES = [
  {
    id: "CogAT_Verbal",
    name: "CogAT Verbal",
    description: "Test verbal reasoning and vocabulary skills",
    icon: "book",
  },
  {
    id: "CogAT_Quantitative",
    name: "CogAT Quantitative",
    description: "Test mathematical and quantitative reasoning",
    icon: "calculator",
  },
  {
    id: "CogAT_Nonverbal",
    name: "CogAT Nonverbal",
    description: "Test spatial and pattern recognition",
    icon: "shapes",
  },
  {
    id: "STAR_Math",
    name: "STAR Math",
    description: "Comprehensive math assessment",
    icon: "plus",
  },
  {
    id: "STAR_Reading",
    name: "STAR Reading",
    description: "Reading comprehension assessment",
    icon: "book-open",
  },
];

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedGrade, setSelectedGrade] = useState('K');
  const { user } = auth;

  const { data: subscription, isLoading } = useQuery({
    queryKey: [`https://smart-ai-tutor.com/api/subscription/${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const response = await fetch(`https://smart-ai-tutor.com/api/subscription/${user.uid}`);
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      return response.json();
    },
    enabled: !!user?.uid,
  });

  const handleTestPress = (testId: string) => {
    navigation.navigate('Quiz', { testType: testId, grade: selectedGrade });
  };

  const handleUpgrade = () => {
    // Navigate to upgrade screen or open web browser
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Test Preparation</Text>
      
      {subscription?.status === "free" && (
        <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
          <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      )}

      <View style={styles.gradeSelector}>
        <Text style={styles.gradeLabel}>Select a grade:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['K', '1', '2', '3', '4', '5'].map((grade) => (
            <TouchableOpacity
              key={grade}
              style={[
                styles.gradeButton,
                selectedGrade === grade && styles.gradeButtonSelected,
              ]}
              onPress={() => setSelectedGrade(grade)}
            >
              <Text style={[
                styles.gradeButtonText,
                selectedGrade === grade && styles.gradeButtonTextSelected,
              ]}>
                {grade === 'K' ? 'Kindergarten' : `Grade ${grade}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.testGrid}>
        {TEST_TYPES.map((test) => (
          <TouchableOpacity
            key={test.id}
            style={styles.testCard}
            onPress={() => handleTestPress(test.id)}
          >
            <Text style={styles.testTitle}>{test.name}</Text>
            <Text style={styles.testDescription}>{test.description}</Text>
          </TouchableOpacity>
        ))}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  upgradeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  gradeSelector: {
    padding: 20,
  },
  gradeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  gradeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  gradeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  gradeButtonText: {
    color: '#333',
  },
  gradeButtonTextSelected: {
    color: 'white',
  },
  testGrid: {
    padding: 10,
  },
  testCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  testDescription: {
    color: '#666',
  },
});

export default DashboardScreen;