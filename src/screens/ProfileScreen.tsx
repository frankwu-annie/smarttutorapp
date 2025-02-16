import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { auth } from '../config/firebase';
import { signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getDatabase, ref, get, set } from 'firebase/database';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavigatorParamList } from '../navigation/types';
import StoreKitService, { subscriptionSkus } from '../services/StoreKit';
import { Product } from 'react-native-iap';

interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

type Props = {
  navigation: NativeStackNavigationProp<NavigatorParamList, 'Profile'>;
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
    fullName: '',
    email: '',
    phoneNumber: '',
    selectedGrade: '',
  });
  const [subscription, setSubscription] = useState<{ status: string }>({ status: 'free' });
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [subscriptionModalVisible, setSubscriptionModalVisible] = useState(false);
  const [subscriptionOptions, setSubscriptionOptions] = useState<SubscriptionOption[]>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false); // Added state for cancel dialog

  useEffect(() => {
    loadProfile();
    loadSubscription();
    initializeStoreKit();
  }, []);

  const loadProfile = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const db = getDatabase();
      const profileRef = ref(db, `users/${userId}/profile`);
      const snapshot = await get(profileRef);
      const data = snapshot.val() || {};

      setProfile({
        fullName: data.fullName || '',
        email: auth.currentUser?.email || '',
        phoneNumber: data.phoneNumber || '',
        selectedGrade: data.selectedGrade || '',
      });
      setEditProfile({
        fullName: data.fullName || '',
        email: auth.currentUser?.email || '',
        phoneNumber: data.phoneNumber || '',
        selectedGrade: data.selectedGrade || '',
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      if (!auth.currentUser?.uid) {
        setSubscription({ status: 'free' });
        return;
      }

      const url = 'https://smart-ai-tutor.com/api/subscription/' + auth.currentUser.uid;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }

      const data = await response.json();
      setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setSubscription({ status: 'free' });
    }
  };

  const initializeStoreKit = async () => {
    try {
      const storeKit = StoreKitService.getInstance();
      await storeKit.initialize();
      const products = storeKit.getProducts();
      const options = products.map(product => ({
        sku: product.productId,
        title: product.title,
        price: product.localizedPrice,
        period: product.subscriptionPeriodAndroid || 'month', // Fallback for iOS
        description: product.description // Add description
      }));
      setSubscriptionOptions(options);
    } catch (error) {
      console.error('Failed to initialize StoreKit:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const db = getDatabase();
      const profileRef = ref(db, `users/${userId}/profile`);
      await set(profileRef, editProfile);

      setProfile(editProfile);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleChangePassword = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user signed in');

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert('Success', 'Password changed successfully!');
      setChangePasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      Alert.alert('Error', 'Failed to change password. Please check your current password.');
      console.error('Error changing password:', error);
    }
  };

  const handleSubscription = async (sku: string) => {
    setLoadingSubscription(true);
    try {
      const storeKit = StoreKitService.getInstance();
      await storeKit.purchaseSubscription(sku);
      await loadSubscription(); // Refresh subscription status
      setSubscriptionModalVisible(false);
      Alert.alert('Success', 'Thank you for subscribing!');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete purchase. Please try again.');
      console.error('Subscription error:', error);
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

  const renderSubscriptionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={subscriptionModalVisible}
      onRequestClose={() => setSubscriptionModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, styles.subscriptionModal]}>
          <Text style={styles.modalTitle}>Upgrade to Premium</Text>
          <Text style={styles.subscriptionDescription}>
            Get unlimited access to all our premium features!
          </Text>

          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✓ Ad-free experience</Text>
            <Text style={styles.featureItem}>✓ Unlimited daily tests</Text>
            <Text style={styles.featureItem}>✓ Advanced progress tracking</Text>
            <Text style={styles.featureItem}>✓ Priority support</Text>
          </View>

          <Text style={styles.cancelNote}>Cancel anytime. No commitment required.</Text>

          <View style={styles.subscriptionOptionsContainer}>
            {subscriptionOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.subscriptionOption,
                  loadingSubscription && styles.buttonDisabled,
                  option.sku.includes('yearly') && styles.yearlyOption
                ]}
                onPress={() => handleSubscription(option.sku)}
                disabled={loadingSubscription}
              >
                <View>
                  <Text style={styles.optionPeriod}>
                    {option.sku.includes('yearly') ? 'Yearly' : 'Monthly'}
                  </Text>
                  <Text style={styles.optionPrice}>{option.price}</Text>
                  {option.sku.includes('yearly') && (
                    <Text style={styles.savingsText}>Save 20%</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => setSubscriptionModalVisible(false)}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderUpgradeButton = () => {
    if (subscription.status !== 'premium') {
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
              onChangeText={(text) => setEditProfile({ ...editProfile, fullName: text })}
            />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={editProfile.phoneNumber}
              onChangeText={(text) => setEditProfile({ ...editProfile, phoneNumber: text })}
            />

            <Text style={styles.label}>Grade Level</Text>
            <TextInput
              style={styles.input}
              value={editProfile.selectedGrade}
              onChangeText={(text) => setEditProfile({ ...editProfile, selectedGrade: text })}
            />

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
              <Text style={styles.value}>{profile?.fullName || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Phone:</Text>
              <Text style={styles.value}>{profile?.phoneNumber || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Grade:</Text>
              <Text style={styles.value}>{profile?.selectedGrade || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tier:</Text>
              <Text style={styles.value}>
                {subscription.status === "premium" ? (
                  <Text>
                    Premium{" "}
                    <Text style={styles.cancelLink} onPress={() => setShowCancelDialog(true)}>
                      Cancel Subscription
                    </Text>
                  </Text>
                ) : (
                  "Free"
                )}
              </Text>
            </View>

            {renderUpgradeButton()}
            <TouchableOpacity style={styles.button} onPress={() => setEditing(true)}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={() => setChangePasswordModalVisible(true)}>
          <Text style={styles.buttonText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Modal
          animationType="slide"
          transparent={true}
          visible={changePasswordModalVisible}
          onRequestClose={() => {
            setChangePasswordModalVisible(false);
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Current Password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <View style={styles.buttonGroup}>
                <TouchableOpacity style={styles.button} onPress={handleChangePassword}>
                  <Text style={styles.buttonText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setChangePasswordModalVisible(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {renderSubscriptionModal()}

        <Modal
          animationType="slide"
          transparent={true}
          visible={showCancelDialog}
          onRequestClose={() => setShowCancelDialog(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cancel Subscription?</Text>
              <Text style={styles.modalText}>
                This will cancel your premium subscription. You'll lose access to premium features at the end of your current billing period.
              </Text>
              <View style={styles.modalButtonsVertical}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, styles.fullWidthButton]}
                  onPress={async () => {
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) {
                        console.error('No current user found');
                        Alert.alert('Error', 'Please log in again');
                        return;
                      }

                      console.log('Starting subscription cancellation process for user:', currentUser.uid);

                      // First cancel through StoreKit/IAP
                      const storeKit = StoreKitService.getInstance();
                      console.log('Attempting to cancel subscription through IAP');

                      try {
                        await storeKit.cancelSubscription();
                        console.log('Successfully cancelled subscription through IAP');
                      } catch (iapError) {
                        console.error('IAP cancellation error:', {
                          error: iapError,
                          message: iapError.message,
                          code: iapError.code
                        });
                        throw new Error('Failed to cancel subscription through app store. Please try again.');
                      }

                      // Then update server
                      console.log('Updating subscription status on server');
                      const response = await fetch('https://smart-ai-tutor.com/api/subscription/cancel', {
                        method: 'POST',
                        headers: {
                          'Accept': 'application/json',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          firebaseId: currentUser.uid
                        })
                      });

                      const responseData = await response.json();
                      console.log('Server cancellation response:', {
                        status: response.status,
                        statusText: response.statusText,
                        data: responseData
                      });

                      if (!response.ok) {
                        console.error('Server cancellation failed:', responseData);
                        throw new Error(responseData.error || 'Failed to update subscription status');
                      }

                      await loadSubscription();
                      setShowCancelDialog(false);
                      Alert.alert('Success', 'Your subscription has been cancelled');
                    } catch (error) {
                      Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
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
  card: {
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  form: {
    marginBottom: 20,
  },
  profileInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 10,
    color: '#666',
  },
  value: {
    fontSize: 16,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#ff3b30',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  signOutText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subscriptionModal: {
    width: '90%',
    maxHeight: '80%',
  },
  subscriptionDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  cancelNote: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  subscriptionOption: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 5,
    flex: 1,
    alignItems: 'center',
  },
  optionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  optionPrice: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  upgradeButton: {
    backgroundColor: '#4CAF50',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  subscriptionOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  yearlyOption: {
    backgroundColor: '#4CAF50',
  },
  optionPeriod: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  cancelLink: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButtonsVertical: {
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  fullWidthButton: {
    width: '100%',
    marginBottom: 10,
  },
});

export default ProfileScreen;