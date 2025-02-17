import React, { useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../config/firebase";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TabParamList } from "../navigation/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, "Dashboard">;
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
  const [selectedGrade, setSelectedGrade] = useState("K");
  const { user } = auth;
  const queryClient = useQueryClient();

  useFocusEffect(
    React.useCallback(() => {
      const fetchGrade = async () => {
        try {
          const storedProfile = await AsyncStorage.getItem("userProfile");
          console.log("Loading profile for grade:", storedProfile);
          if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            if (profile.selectedGrade) {
              console.log("Setting grade from profile:", profile.selectedGrade);
              setSelectedGrade(profile.selectedGrade);
            }
          }
        } catch (error) {
          console.error("Error fetching grade from profile:", error);
        }
      };
      fetchGrade();
    }, []),
  );

  useEffect(() => {
    const saveGrade = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem("userProfile");
        const profile = storedProfile ? JSON.parse(storedProfile) : {};
        const updatedProfile = {
          ...profile,
          selectedGrade,
        };
        console.log("Saving updated profile with grade:", updatedProfile);
        await AsyncStorage.setItem(
          "userProfile",
          JSON.stringify(updatedProfile),
        );
      } catch (error) {
        console.error("Error saving grade to profile:", error);
      }
    };
    saveGrade();
  }, [selectedGrade]);

  const { data: subscription, isLoading } = useQuery({
    queryKey: [`https://smart-ai-tutor.com/api/subscription/${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${user.uid}`,
      );
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      return response.json();
    },
    enabled: !!user?.uid,
  });

  const handleTestPress = (testId: string) => {
    navigation.navigate("Quiz", { testType: testId, grade: selectedGrade });
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

  const scrollViewRef = React.useRef(null);
  const gradeButtonRefs = React.useRef({});

  const scrollToSelectedGrade = () => {
    if (scrollViewRef.current && gradeButtonRefs.current[selectedGrade]) {
      gradeButtonRefs.current[selectedGrade].measureLayout(
        scrollViewRef.current,
        (x) => {
          scrollViewRef.current.scrollTo({ x: x - 20, animated: true });
        },
        () => console.log('measurement failed')
      );
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setTimeout(scrollToSelectedGrade, 100);
    }, [selectedGrade])
  );

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
        <ScrollView ref={scrollViewRef} horizontal showsHorizontalScrollIndicator={false}>
          {["K", "1", "2", "3", "4", "5"].map((grade) => (
            <TouchableOpacity
              key={grade}
              ref={ref => gradeButtonRefs.current[grade] = ref}
              style={[
                styles.gradeButton,
                selectedGrade === grade && styles.gradeButtonSelected,
              ]}
              onPress={() => setSelectedGrade(grade)}
            >
              <Text
                style={[
                  styles.gradeButtonText,
                  selectedGrade === grade && styles.gradeButtonTextSelected,
                ]}
              >
                {grade === "K" ? "Kindergarten" : `Grade ${grade}`}
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
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    padding: 20,
  },
  upgradeButton: {
    backgroundColor: "#007AFF",
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  upgradeButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  gradeSelector: {
    padding: 20,
    marginBottom: 10,
  },
  gradeLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  gradeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    minWidth: 100,
  },
  gradeButtonSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  gradeButtonText: {
    color: "#333",
  },
  gradeButtonTextSelected: {
    color: "white",
  },
  testGrid: {
    padding: 10,
  },
  testCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  testDescription: {
    color: "#666",
  },
});

export default DashboardScreen;


/* import React, { useState, useEffect } from "react";
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from "../config/firebase";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TabParamList } from "../navigation/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Props = {
  navigation: NativeStackNavigationProp<TabParamList, "Dashboard">;
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
  const [selectedGrade, setSelectedGrade] = useState("K");
  const { user } = auth;
  const queryClient = useQueryClient();

  useFocusEffect(
    React.useCallback(() => {
      const fetchGrade = async () => {
        try {
          const storedProfile = await AsyncStorage.getItem('userProfile');
          console.log('Loading profile for grade:', storedProfile);
          if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            if (profile.selectedGrade) {
              console.log('Setting grade from profile:', profile.selectedGrade);
              setSelectedGrade(profile.selectedGrade);
            }
          }
        } catch (error) {
          console.error("Error fetching grade from profile:", error);
        }
      };
      fetchGrade();
    }, [])
  );

  useEffect(() => {
    const saveGrade = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('userProfile');
        const profile = storedProfile ? JSON.parse(storedProfile) : {};
        const updatedProfile = {
          ...profile,
          selectedGrade
        };
        console.log('Saving updated profile with grade:', updatedProfile);
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      } catch (error) {
        console.error("Error saving grade to profile:", error);
      }
    };
    saveGrade();
  }, [selectedGrade]);


  const { data: subscription, isLoading } = useQuery({
    queryKey: [`https://smart-ai-tutor.com/api/subscription/${user?.uid}`],
    queryFn: async () => {
      if (!user?.uid) return null;
      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${user.uid}`,
      );
      if (!response.ok) throw new Error("Failed to fetch subscription status");
      return response.json();
    },
    enabled: !!user?.uid,
  });

  const handleTestPress = (testId: string) => {
    navigation.navigate("Quiz", { testType: testId, grade: selectedGrade });
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
          {["K", "1", "2", "3", "4", "5"].map((grade) => (
            <TouchableOpacity
              key={grade}
              style={[
                styles.gradeButton,
                selectedGrade === grade && styles.gradeButtonSelected,
              ]}
              onPress={() => setSelectedGrade(grade)}
            >
              <Text
                style={[
                  styles.gradeButtonText,
                  selectedGrade === grade && styles.gradeButtonTextSelected,
                ]}
              >
                {grade === "K" ? "Kindergarten" : `Grade ${grade}`}
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
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    padding: 20,
  },
  upgradeButton: {
    backgroundColor: "#007AFF",
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  upgradeButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  gradeSelector: {
    padding: 20,
  },
  gradeLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  gradeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  gradeButtonSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  gradeButtonText: {
    color: "#333",
  },
  gradeButtonTextSelected: {
    color: "white",
  },
  testGrid: {
    padding: 10,
  },
  testCard: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
    marginHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  testDescription: {
    color: "#666",
  },
});

export default DashboardScreen;

 */