import React, { useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  ActionSheetIOS,
  Linking,
} from "react-native";
import { auth } from "../config/firebase";
import {
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NavigatorParamList } from "../navigation/types";
import StoreKitService from "../services/StoreKit";
import UpgradePrompt from "../components/UpgradePrompt";

interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

type Props = {
  navigation: NativeStackNavigationProp<NavigatorParamList, "Profile">;
};

type UserProfile = {
  fullName: string;
  email: string;
  phoneNumber: string;
  selectedGrade: string;
};

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<UserProfile>({
    fullName: "",
    email: "",
    phoneNumber: "",
    selectedGrade: "",
  });
  const [subscription, setSubscription] = useState<{ status: string }>({
    status: "free",
  });
  const [changePasswordModalVisible, setChangePasswordModalVisible] =
    useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [subscriptionModalVisible, setSubscriptionModalVisible] =
    useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState<
    SubscriptionOption[]
  >([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);

  useEffect(() => {
    loadSubscription();
    initializeStoreKit();
  }, []);

  const handleDeleteAccount = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No user found");
      }

      // Delete from Firebase Authentication
      await user.delete();

      // Delete from backend database
      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${user.uid}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete user data");
      }

      Alert.alert("Success", "Your account has been permanently deleted");
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, []),
  );

  const loadProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem("userProfile");
      console.log("Loading profile from storage:", storedProfile);

      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        const profileData = {
          ...parsedProfile,
          email: auth.currentUser?.email || "",
        };
        console.log("Setting profile data:", profileData);
        setProfile(profileData);
        setEditProfile(profileData);
      } else {
        const defaultProfile = {
          fullName: "",
          email: auth.currentUser?.email || "",
          phoneNumber: "",
          selectedGrade: "K",
        };
        console.log("Setting default profile:", defaultProfile);
        setProfile(defaultProfile);
        setEditProfile(defaultProfile);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      if (!auth.currentUser?.uid) {
        setSubscription({ status: "free" });
        return;
      }

      const url =
        "https://smart-ai-tutor.com/api/subscription/" + auth.currentUser.uid;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error("Error loading subscription:", error);
      setSubscription({ status: "free" });
    }
  };

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

  const handleSaveProfile = async () => {
    try {
      console.log("Saving profile:", editProfile);
      await AsyncStorage.setItem("userProfile", JSON.stringify(editProfile));
      setProfile(editProfile);
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
    }
  };

  const handleChangePassword = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user signed in");

      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Success", "Password changed successfully!");
      setChangePasswordModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to change password. Please check your current password.",
      );
      console.error("Error changing password:", error);
    }
  };

  const handleSubscription = async (sku: string) => {
    setLoadingSubscription(true);
    try {
      const storeKit = StoreKitService.getInstance();
      await storeKit.purchaseSubscription(sku);
      await loadSubscription();
      setSubscriptionModalVisible(false);
      Alert.alert("Success", "Thank you for subscribing!");
    } catch (error) {
      Alert.alert("Error", "Failed to complete purchase. Please try again.");
      console.error("Subscription error:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderUpgradeButton = () => {
    if (subscription.status !== "premium") {
      return (
        <TouchableOpacity
          style={[styles.button, styles.upgradeButton]}
          onPress={() => setSubscriptionModalVisible(true)}
        >
          <Text style={styles.buttonText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>

        {editing ? (
          <View style={styles.form}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile?.email}</Text>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editProfile.fullName}
              onChangeText={(text) =>
                setEditProfile({ ...editProfile, fullName: text })
              }
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={editProfile.phoneNumber}
              onChangeText={(text) =>
                setEditProfile({ ...editProfile, phoneNumber: text })
              }
            />

            <Text style={styles.label}>Grade Level</Text>
            <TouchableOpacity
              style={styles.gradeButton}
              onPress={() => {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: [
                      "Cancel",
                      "Kindergarten",
                      "Grade 1",
                      "Grade 2",
                      "Grade 3",
                      "Grade 4",
                      "Grade 5",
                    ],
                    cancelButtonIndex: 0,
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 0) {
                      return;
                    }
                    const gradeValues = ["K", "1", "2", "3", "4", "5"];
                    setEditProfile({
                      ...editProfile,
                      selectedGrade: gradeValues[buttonIndex - 1],
                    });
                  },
                );
              }}
            >
              <Text style={styles.gradeButtonText}>
                {editProfile.selectedGrade === "K"
                  ? "Kindergarten"
                  : `Grade ${editProfile.selectedGrade}`}
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSaveProfile}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{profile?.fullName || "Not set"}</Text>
            </View>
            {/*             <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile?.email}</Text>
            </View> */}
            <View style={styles.infoRow}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>
                {profile?.phoneNumber || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Grade:</Text>
              <Text style={styles.value}>
                {profile?.selectedGrade || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tier:</Text>
              <Text style={styles.value}>
                {subscription.status === "premium" ? (
                  <Text>
                    Premium{" "}
                    <Text
                      style={styles.cancelLink}
                      onPress={() => setShowCancelDialog(true)}
                    >
                      Cancel Subscription
                    </Text>
                  </Text>
                ) : (
                  "Free"
                )}
              </Text>
            </View>

            <View style={styles.linksWrapper}>
              <View style={styles.linksContainer}>
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Text style={styles.link}>Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setChangePasswordModalVisible(true)}
                >
                  <Text style={styles.link}>Change Password</Text>
                </TouchableOpacity>
              </View>
            </View>
            {renderUpgradeButton()}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.deleteAccountButton]}
          onPress={() => setShowDeleteAccountDialog(true)}
        >
          <Text style={styles.buttonText}>Delete Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signOutButton, styles.signOutSpacing]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete Account Confirmation Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={showDeleteAccountDialog}
          onRequestClose={() => setShowDeleteAccountDialog(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete Account?</Text>
              <Text style={styles.modalText}>
                This action cannot be undone. All your data will be permanently
                deleted.
              </Text>
              <View style={styles.modalButtonsVertical}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    styles.fullWidthButton,
                  ]}
                  onPress={handleDeleteAccount}
                >
                  <Text style={styles.buttonText}>Yes, Delete My Account</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.fullWidthButton]}
                  onPress={() => setShowDeleteAccountDialog(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Password Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={changePasswordModalVisible}
          onRequestClose={() => setChangePasswordModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Current Password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="New Password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor="#999"
              />
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleChangePassword}
                >
                  <Text style={styles.buttonText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setChangePasswordModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Cancel Subscription Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={showCancelDialog}
          onRequestClose={() => setShowCancelDialog(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cancel Subscription?</Text>
              <Text style={styles.modalText}>
                This will cancel your premium subscription. You'll lose access
                to premium features at the end of your current billing period.
              </Text>
              <View style={styles.modalButtonsVertical}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    styles.fullWidthButton,
                  ]}
                  onPress={async () => {
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) {
                        console.error("No current user found");
                        Alert.alert("Error", "Please log in again");
                        return;
                      }
                      console.log(
                        "Starting subscription cancellation process for user:",
                        currentUser.uid,
                      );
                      const storeKit = StoreKitService.getInstance();
                      if (Platform.OS === 'ios') {
                        await storeKit.openSubscriptionManagement();
                        setShowCancelDialog(false);
                        Alert.alert(
                          "Manage Subscription",
                          "Please manage your subscription in the App Store settings.",
                        );
                        return;
                      }
                      console.log("Updating subscription status on server");
                      const response = await fetch(
                        "https://smart-ai-tutor.com/api/subscription/cancel",
                        {
                          method: "POST",
                          headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            firebaseId: currentUser.uid,
                          }),
                        },
                      );
                      const responseData = await response.json();
                      console.log(
                        "Server cancellation response:",
                        responseData,
                      );
                      if (!response.ok) {
                        console.error(
                          "Server cancellation failed:",
                          responseData,
                        );
                        throw new Error(
                          responseData.error ||
                            "Failed to update subscription status",
                        );
                      }
                      await loadSubscription();
                      setShowCancelDialog(false);
                      Alert.alert(
                        "Success",
                        "Your subscription has been cancelled",
                      );
                    } catch (error) {
                      Alert.alert(
                        "Error",
                        "Failed to cancel subscription. Please try again.",
                      );
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Cancel Subscription</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.fullWidthButton]}
                  onPress={() => setShowCancelDialog(false)}
                >
                  <Text style={styles.buttonText}>Keep Subscription</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Upgrade Prompt Modal */}
        <UpgradePrompt
          visible={subscriptionModalVisible}
          onClose={() => setSubscriptionModalVisible(false)}
          subscriptionOptions={subscriptionOptions}
          onSubscribe={handleSubscription}
          loadingSubscription={loadingSubscription}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  deleteAccountButton: {
    backgroundColor: "#666",
    marginTop: 20,
  },
  signOutSpacing: {
    marginTop: 15,
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
  card: {
    backgroundColor: "white",
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  form: {
    marginBottom: 20,
  },
  profileInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginRight: 10,
    color: "#666",
  },
  value: {
    fontSize: 16,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  upgradeButton: {
    backgroundColor: "#4CAF50",
    marginBottom: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: "#ff3b30",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  signOutText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtonsVertical: {
    flexDirection: "column",
    justifyContent: "space-around",
  },
  fullWidthButton: {
    width: "100%",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  gradeButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  gradeButtonText: {
    fontSize: 16,
    color: "#000",
  },
  linksWrapper: {
    marginVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 25,
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  link: {
    color: "#007AFF",
    fontSize: 16,
    textDecorationLine: "underline",
  },
  // Added cancelLink style
  cancelLink: {
    color: "blue",
    textDecorationLine: "underline",
  },
});

export default ProfileScreen;

/* import React, { useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  ActionSheetIOS,
  Linking,
} from "react-native";
import { auth } from "../config/firebase";
import {
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NavigatorParamList } from "../navigation/types";
import StoreKitService from "../services/StoreKit";
import UpgradePrompt from "../components/UpgradePrompt";

interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

type Props = {
  navigation: NativeStackNavigationProp<NavigatorParamList, "Profile">;
};

type UserProfile = {
  fullName: string;
  email: string;
  phoneNumber: string;
  selectedGrade: string;
};

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<UserProfile>({
    fullName: "",
    email: "",
    phoneNumber: "",
    selectedGrade: "",
  });
  const [subscription, setSubscription] = useState<{ status: string }>({
    status: "free",
  });
  const [changePasswordModalVisible, setChangePasswordModalVisible] =
    useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [subscriptionModalVisible, setSubscriptionModalVisible] =
    useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState<
    SubscriptionOption[]
  >([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);

  useEffect(() => {
    loadSubscription();
    initializeStoreKit();
  }, []);

  const handleDeleteAccount = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user found');
      }

      // Delete from Firebase Authentication
      await user.delete();

      // Delete from backend database
      const response = await fetch(`https://smart-ai-tutor.com/api/subscription/${user.uid}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user data');
      }

      Alert.alert('Success', 'Your account has been permanently deleted');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, []),
  );

  const loadProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem("userProfile");
      console.log("Loading profile from storage:", storedProfile);

      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        const profileData = {
          ...parsedProfile,
          email: auth.currentUser?.email || "",
        };
        console.log("Setting profile data:", profileData);
        setProfile(profileData);
        setEditProfile(profileData);
      } else {
        const defaultProfile = {
          fullName: "",
          email: auth.currentUser?.email || "",
          phoneNumber: "",
          selectedGrade: "K",
        };
        console.log("Setting default profile:", defaultProfile);
        setProfile(defaultProfile);
        setEditProfile(defaultProfile);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      if (!auth.currentUser?.uid) {
        setSubscription({ status: "free" });
        return;
      }

      const url =
        "https://smart-ai-tutor.com/api/subscription/" + auth.currentUser.uid;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error("Error loading subscription:", error);
      setSubscription({ status: "free" });
    }
  };

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

  const handleSaveProfile = async () => {
    try {
      console.log("Saving profile:", editProfile);
      await AsyncStorage.setItem("userProfile", JSON.stringify(editProfile));
      setProfile(editProfile);
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
    }
  };

  const handleChangePassword = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user signed in");

      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Success", "Password changed successfully!");
      setChangePasswordModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to change password. Please check your current password.",
      );
      console.error("Error changing password:", error);
    }
  };

  const handleSubscription = async (sku: string) => {
    setLoadingSubscription(true);
    try {
      const storeKit = StoreKitService.getInstance();
      await storeKit.purchaseSubscription(sku);
      await loadSubscription();
      setSubscriptionModalVisible(false);
      Alert.alert("Success", "Thank you for subscribing!");
    } catch (error) {
      Alert.alert("Error", "Failed to complete purchase. Please try again.");
      console.error("Subscription error:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderUpgradeButton = () => {
    if (subscription.status !== "premium") {
      return (
        <TouchableOpacity
          style={[styles.button, styles.upgradeButton]}
          onPress={() => setSubscriptionModalVisible(true)}
        >
          <Text style={styles.buttonText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>

        {editing ? (
          <View style={styles.form}>

<View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile?.email}</Text>
            </View>
            
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editProfile.fullName}
              onChangeText={(text) =>
                setEditProfile({ ...editProfile, fullName: text })
              }
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={editProfile.phoneNumber}
              onChangeText={(text) =>
                setEditProfile({ ...editProfile, phoneNumber: text })
              }
            />

            <Text style={styles.label}>Grade Level</Text>
            <TouchableOpacity
              style={styles.gradeButton}
              onPress={() => {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: [
                      "Cancel",
                      "Kindergarten",
                      "Grade 1",
                      "Grade 2",
                      "Grade 3",
                      "Grade 4",
                      "Grade 5",
                    ],
                    cancelButtonIndex: 0,
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 0) {
                      return;
                    }
                    const gradeValues = ["K", "1", "2", "3", "4", "5"];
                    setEditProfile({
                      ...editProfile,
                      selectedGrade: gradeValues[buttonIndex - 1],
                    });
                  },
                );
              }}
            >
              <Text style={styles.gradeButtonText}>
                {editProfile.selectedGrade === "K"
                  ? "Kindergarten"
                  : `Grade ${editProfile.selectedGrade}`}
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSaveProfile}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>{profile?.fullName || "Not set"}</Text>
            </View>
             <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile?.email}</Text>
            </View> *
            <View style={styles.infoRow}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>
                {profile?.phoneNumber || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Grade:</Text>
              <Text style={styles.value}>
                {profile?.selectedGrade || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tier:</Text>
              <Text style={styles.value}>
                {subscription.status === "premium" ? (
                  <Text>
                    Premium{" "}
                    <Text
                      style={styles.cancelLink}
                      onPress={() => setShowCancelDialog(true)}
                    >
                      Cancel Subscription
                    </Text>
                  </Text>
                ) : (
                  "Free"
                )}
              </Text>
            </View>

            <View style={styles.linksWrapper}>
              <View style={styles.linksContainer}>
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Text style={styles.link}>Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setChangePasswordModalVisible(true)}
                >
                  <Text style={styles.link}>Change Password</Text>
                </TouchableOpacity>
              </View>
            </View>
            {renderUpgradeButton()}
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.deleteAccountButton]} 
          onPress={() => setShowDeleteAccountDialog(true)}
        >
          <Text style={styles.buttonText}>Delete Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.signOutButton, styles.signOutSpacing]} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

       
        <Modal
          animationType="slide"
          transparent
          visible={showDeleteAccountDialog}
          onRequestClose={() => setShowDeleteAccountDialog(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete Account?</Text>
              <Text style={styles.modalText}>
                This action cannot be undone. All your data will be permanently deleted.
              </Text>
              <View style={styles.modalButtonsVertical}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, styles.fullWidthButton]}
                  onPress={handleDeleteAccount}
                >
                  <Text style={styles.buttonText}>Yes, Delete My Account</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.fullWidthButton]}
                  onPress={() => setShowDeleteAccountDialog(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="slide"
          transparent
          visible={changePasswordModalVisible}
          onRequestClose={() => setChangePasswordModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Current Password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="New Password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor="#999"
              />
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleChangePassword}
                >
                  <Text style={styles.buttonText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setChangePasswordModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        
        <Modal
          animationType="slide"
          transparent
          visible={showCancelDialog}
          onRequestClose={() => setShowCancelDialog(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cancel Subscription?</Text>
              <Text style={styles.modalText}>
                This will cancel your premium subscription. You'll lose access
                to premium features at the end of your current billing period.
              </Text>
              <View style={styles.modalButtonsVertical}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    styles.fullWidthButton,
                  ]}
                  onPress={async () => {
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) {
                        console.error("No current user found");
                        Alert.alert("Error", "Please log in again");
                        return;
                      }
                      console.log(
                        "Starting subscription cancellation process for user:",
                        currentUser.uid,
                      );
                      const storeKit = StoreKitService.getInstance();
                      console.log(
                        "Attempting to cancel subscription through IAP",
                      );
                      try {
                        await storeKit.cancelSubscription();
                        console.log(
                          "Successfully cancelled subscription through IAP",
                        );
                      } catch (iapError) {
                        console.error("IAP cancellation error:", iapError);
                        throw new Error(
                          "Failed to cancel subscription through app store. Please try again.",
                        );
                      }
                      console.log("Updating subscription status on server");
                      const response = await fetch(
                        "https://smart-ai-tutor.com/api/subscription/cancel",
                        {
                          method: "POST",
                          headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            firebaseId: currentUser.uid,
                          }),
                        },
                      );
                      const responseData = await response.json();
                      console.log(
                        "Server cancellation response:",
                        responseData,
                      );
                      if (!response.ok) {
                        console.error(
                          "Server cancellation failed:",
                          responseData,
                        );
                        throw new Error(
                          responseData.error ||
                            "Failed to update subscription status",
                        );
                      }
                      await loadSubscription();
                      setShowCancelDialog(false);
                      Alert.alert(
                        "Success",
                        "Your subscription has been cancelled",
                      );
                    } catch (error) {
                      Alert.alert(
                        "Error",
                        "Failed to cancel subscription. Please try again.",
                      );
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Cancel Subscription</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.fullWidthButton]}
                  onPress={() => setShowCancelDialog(false)}
                >
                  <Text style={styles.buttonText}>Keep Subscription</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        
        <UpgradePrompt
          visible={subscriptionModalVisible}
          onClose={() => setSubscriptionModalVisible(false)}
          subscriptionOptions={subscriptionOptions}
          onSubscribe={handleSubscription}
          loadingSubscription={loadingSubscription}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  deleteAccountButton: {
    backgroundColor: '#666',
    marginTop: 20,
  },
  signOutSpacing: {
    marginTop: 15,
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
  card: {
    backgroundColor: "white",
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  form: {
    marginBottom: 20,
  },
  profileInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginRight: 10,
    color: "#666",
  },
  value: {
    fontSize: 16,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  upgradeButton: {
    backgroundColor: "#4CAF50",
    marginBottom: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: "#ff3b30",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  signOutText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtonsVertical: {
    flexDirection: "column",
    justifyContent: "space-around",
  },
  fullWidthButton: {
    width: "100%",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  gradeButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  gradeButtonText: {
    fontSize: 16,
    color: "#000",
  },
  linksWrapper: {
    marginVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 25,
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  link: {
    color: "#007AFF",
    fontSize: 16,
    textDecorationLine: "underline",
  },
  // Added cancelLink style
  cancelLink: {
    color: "blue",
    textDecorationLine: "underline",
  },
});

export default ProfileScreen; */

/* import React, { useState, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  ActionSheetIOS,
  Linking,
} from "react-native";
import { auth } from "../config/firebase";
import {
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NavigatorParamList } from "../navigation/types";
import StoreKitService from "../services/StoreKit";
import UpgradePrompt from "../components/UpgradePrompt";

interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

type Props = {
  navigation: NativeStackNavigationProp<NavigatorParamList, "Profile">;
};

type UserProfile = {
  fullName: string;
  email: string;
  phoneNumber: string;
  selectedGrade: string;
};

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<UserProfile>({
    fullName: "",
    email: "",
    phoneNumber: "",
    selectedGrade: "",
  });
  const [subscription, setSubscription] = useState<{ status: string }>({
    status: "free",
  });
  const [changePasswordModalVisible, setChangePasswordModalVisible] =
    useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [subscriptionModalVisible, setSubscriptionModalVisible] =
    useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState<
    SubscriptionOption[]
  >([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    loadSubscription();
    initializeStoreKit();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem("userProfile");
      console.log("Loading profile from storage:", storedProfile);

      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        const profileData = {
          ...parsedProfile,
          email: auth.currentUser?.email || "",
        };
        console.log("Setting profile data:", profileData);
        setProfile(profileData);
        setEditProfile(profileData);
      } else {
        const defaultProfile = {
          fullName: "",
          email: auth.currentUser?.email || "",
          phoneNumber: "",
          selectedGrade: "K",
        };
        console.log("Setting default profile:", defaultProfile);
        setProfile(defaultProfile);
        setEditProfile(defaultProfile);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      if (!auth.currentUser?.uid) {
        setSubscription({ status: "free" });
        return;
      }

      const url =
        "https://smart-ai-tutor.com/api/subscription/" + auth.currentUser.uid;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error("Error loading subscription:", error);
      setSubscription({ status: "free" });
    }
  };

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

  const handleSaveProfile = async () => {
    try {
      console.log("Saving profile:", editProfile);
      await AsyncStorage.setItem("userProfile", JSON.stringify(editProfile));
      setProfile(editProfile);
      setEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
    }
  };

  const handleChangePassword = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No user signed in");

      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert("Success", "Password changed successfully!");
      setChangePasswordModalVisible(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to change password. Please check your current password."
      );
      console.error("Error changing password:", error);
    }
  };

  const handleSubscription = async (sku: string) => {
    setLoadingSubscription(true);
    try {
      const storeKit = StoreKitService.getInstance();
      await storeKit.purchaseSubscription(sku);
      await loadSubscription();
      setSubscriptionModalVisible(false);
      Alert.alert("Success", "Thank you for subscribing!");
    } catch (error) {
      Alert.alert("Error", "Failed to complete purchase. Please try again.");
      console.error("Subscription error:", error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderUpgradeButton = () => {
    if (subscription.status !== "premium") {
      return (
        <TouchableOpacity
          style={[styles.button, styles.upgradeButton]}
          onPress={() => setSubscriptionModalVisible(true)}
        >
          <Text style={styles.buttonText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>

        {editing ? (
          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editProfile.fullName}
              onChangeText={(text) =>
                setEditProfile({ ...editProfile, fullName: text })
              }
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={editProfile.phoneNumber}
              onChangeText={(text) =>
                setEditProfile({ ...editProfile, phoneNumber: text })
              }
            />

            <Text style={styles.label}>Grade Level</Text>
            <TouchableOpacity
              style={styles.gradeButton}
              onPress={() => {
                ActionSheetIOS.showActionSheetWithOptions(
                  {
                    options: [
                      "Cancel",
                      "Kindergarten",
                      "Grade 1",
                      "Grade 2",
                      "Grade 3",
                      "Grade 4",
                      "Grade 5",
                    ],
                    cancelButtonIndex: 0,
                  },
                  (buttonIndex) => {
                    if (buttonIndex === 0) {
                      return;
                    }
                    const gradeValues = ["K", "1", "2", "3", "4", "5"];
                    setEditProfile({
                      ...editProfile,
                      selectedGrade: gradeValues[buttonIndex - 1],
                    });
                  }
                );
              }}
            >
              <Text style={styles.gradeButtonText}>
                {editProfile.selectedGrade === "K"
                  ? "Kindergarten"
                  : `Grade ${editProfile.selectedGrade}`}
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.button} onPress={handleSaveProfile}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Name:</Text>
              <Text style={styles.value}>
                {profile?.fullName || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile?.email}</Text>
            </View> 
            <View style={styles.infoRow}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>
                {profile?.phoneNumber || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Grade:</Text>
              <Text style={styles.value}>
                {profile?.selectedGrade || "Not set"}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tier:</Text>
              <Text style={styles.value}>
                {subscription.status === "premium" ? (
                  <Text>
                    Premium{" "}
                    <Text
                      style={styles.cancelLink}
                      onPress={() => setShowCancelDialog(true)}
                    >
                      Cancel Subscription
                    </Text>
                  </Text>
                ) : (
                  "Free"
                )}
              </Text>
            </View>

            <View style={styles.linksWrapper}>
              <View style={styles.linksContainer}>
                <TouchableOpacity onPress={() => setEditing(true)}>
                  <Text style={styles.link}>Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setChangePasswordModalVisible(true)}
                >
                  <Text style={styles.link}>Change Password</Text>
                </TouchableOpacity>
              </View>
            </View>
            {renderUpgradeButton()}
          </View>
        )}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        
        <Modal
          animationType="slide"
          transparent
          visible={changePasswordModalVisible}
          onRequestClose={() => setChangePasswordModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Current Password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="New Password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor="#999"
              />
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleChangePassword}
                >
                  <Text style={styles.buttonText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setChangePasswordModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

       
        <Modal
          animationType="slide"
          transparent
          visible={showCancelDialog}
          onRequestClose={() => setShowCancelDialog(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cancel Subscription?</Text>
              <Text style={styles.modalText}>
                This will cancel your premium subscription. You'll lose access to
                premium features at the end of your current billing period.
              </Text>
              <View style={styles.modalButtonsVertical}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    styles.fullWidthButton,
                  ]}
                  onPress={async () => {
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) {
                        console.error("No current user found");
                        Alert.alert("Error", "Please log in again");
                        return;
                      }
                      console.log(
                        "Starting subscription cancellation process for user:",
                        currentUser.uid
                      );
                      const storeKit = StoreKitService.getInstance();
                      console.log("Attempting to cancel subscription through IAP");
                      try {
                        await storeKit.cancelSubscription();
                        console.log("Successfully cancelled subscription through IAP");
                      } catch (iapError) {
                        console.error("IAP cancellation error:", iapError);
                        throw new Error(
                          "Failed to cancel subscription through app store. Please try again."
                        );
                      }
                      console.log("Updating subscription status on server");
                      const response = await fetch(
                        "https://smart-ai-tutor.com/api/subscription/cancel",
                        {
                          method: "POST",
                          headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            firebaseId: currentUser.uid,
                          }),
                        }
                      );
                      const responseData = await response.json();
                      console.log("Server cancellation response:", responseData);
                      if (!response.ok) {
                        console.error("Server cancellation failed:", responseData);
                        throw new Error(
                          responseData.error ||
                            "Failed to update subscription status"
                        );
                      }
                      await loadSubscription();
                      setShowCancelDialog(false);
                      Alert.alert("Success", "Your subscription has been cancelled");
                    } catch (error) {
                      Alert.alert("Error", "Failed to cancel subscription. Please try again.");
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Cancel Subscription</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.fullWidthButton]}
                  onPress={() => setShowCancelDialog(false)}
                >
                  <Text style={styles.buttonText}>Keep Subscription</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        
        <UpgradePrompt
          visible={subscriptionModalVisible}
          onClose={() => setSubscriptionModalVisible(false)}
          subscriptionOptions={subscriptionOptions}
          onSubscribe={handleSubscription}
          loadingSubscription={loadingSubscription}
        />
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
  card: {
    backgroundColor: "white",
    margin: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  form: {
    marginBottom: 20,
  },
  profileInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginRight: 10,
    color: "#666",
  },
  value: {
    fontSize: 16,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  upgradeButton: {
    backgroundColor: "#4CAF50",
    marginBottom: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: "#ff3b30",
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  signOutText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtonsVertical: {
    flexDirection: "column",
    justifyContent: "space-around",
  },
  fullWidthButton: {
    width: "100%",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  gradeButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: "#fff",
  },
  gradeButtonText: {
    fontSize: 16,
    color: "#000",
  },
  linksWrapper: {
    marginVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 25,
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  link: {
    color: "#007AFF",
    fontSize: 16,
    textDecorationLine: "underline",
  },
  cancelLink: {
    color: "blue",
    textDecorationLine: "underline",
  },  
});

export default ProfileScreen; 


 */