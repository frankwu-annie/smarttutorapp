import React, { useState, useEffect } from 'react';
import { Product } from 'react-native-iap';
import StoreKitService from '../services/StoreKit';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { auth } from '../config/firebase';

type Props = {
  visible: boolean;
  onClose: () => void;
  testsCompleted?: number;
  showPremiumWarning?: boolean;
};

export const UpgradePrompt: React.FC<Props> = ({ 
  visible, 
  onClose, 
  testsCompleted,
  showPremiumWarning = false 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      if (visible) {
        setIsLoadingProducts(true);
        try {
          const storeKit = StoreKitService.getInstance();
          await storeKit.initialize();
          const availableProducts = storeKit.getProducts();
          setProducts(availableProducts);
        } catch (error) {
          console.error('Error loading products:', error);
        } finally {
          setIsLoadingProducts(false);
        }
      }
    };
    
    loadProducts();
  }, [visible]);

  const handleUpgrade = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please sign in to upgrade your account.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("https://smart-ai-tutor.com/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseId: auth.currentUser.uid,
          email: auth.currentUser.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      await Linking.openURL(url);
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Get unlimited access to all our premium features!
          </Text>

          <Text style={styles.subtitle}>Premium Features:</Text>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.featuresContainer}>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Ad-free experience</Text>
              </View>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Unlimited daily tests</Text>
              </View>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Advanced analytics and progress tracking</Text>
              </View>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Priority support</Text>
              </View>
              {products.map((product) => (
                <View key={product.productId} style={styles.featureRow}>
                  <Check width={20} height={20} color="#4CAF50" />
                  <Text style={styles.feature}>{product.title} - {product.localizedPrice}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.cancelText}>
              Cancel anytime. No commitment required.
            </Text>

            <TouchableOpacity
              style={[styles.upgradeButton, isLoading && styles.disabledButton]}
              onPress={handleUpgrade}
              disabled={isLoading}
            >
              <Text style={styles.upgradeButtonText}>
                {isLoading ? "Processing..." : "Upgrade Now"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={onClose}
            >
              <Text style={styles.continueButtonText}>
                Continue with free version
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  feature: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  cancelText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  continueButton: {
    padding: 12,
  },
  continueButtonText: {
    color: '#2563EB',
    textAlign: 'center',
    fontSize: 16,
  },
});
/* import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import { auth } from '../config/firebase';

type Props = {
  visible: boolean;
  onClose: () => void;
  testsCompleted?: number;
  showPremiumWarning?: boolean;
};

export const UpgradePrompt: React.FC<Props> = ({ 
  visible, 
  onClose, 
  testsCompleted,
  showPremiumWarning = false 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      fetch('https://smart-ai-tutor.com/api/subscription/price')
        .then(res => res.json())
        .then(data => setPrice(data.price))
        .catch(err => console.error('Error fetching price:', err));
    }
  }, [visible]);

  const handleUpgrade = async () => {
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please sign in to upgrade your account.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("https://smart-ai-tutor.com/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firebaseId: auth.currentUser.uid,
          email: auth.currentUser.email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      await Linking.openURL(url);
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Upgrade to Premium</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            Get unlimited access to all our premium features!
          </Text>

          <Text style={styles.subtitle}>Premium Features:</Text>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.featuresContainer}>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Ad-free experience</Text>
              </View>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Unlimited daily tests</Text>
              </View>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Advanced analytics and progress tracking</Text>
              </View>
              <View style={styles.featureRow}>
                <Check width={20} height={20} color="#4CAF50" />
                <Text style={styles.feature}>Priority support</Text>
              </View>
              {price && (
                <View style={styles.featureRow}>
                  <Check width={20} height={20} color="#4CAF50" />
                  <Text style={styles.feature}>Just ${price.toFixed(2)}/month - less than a cup of coffee!</Text>
                </View>
              )}
            </View>

            <Text style={styles.cancelText}>
              Cancel anytime. No commitment required.
            </Text>

            <TouchableOpacity
              style={[styles.upgradeButton, isLoading && styles.disabledButton]}
              onPress={handleUpgrade}
              disabled={isLoading}
            >
              <Text style={styles.upgradeButtonText}>
                {isLoading ? "Processing..." : "Upgrade Now"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={onClose}
            >
              <Text style={styles.continueButtonText}>
                Continue with free version
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  feature: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  cancelText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  continueButton: {
    padding: 12,
  },
  continueButtonText: {
    color: '#2563EB',
    textAlign: 'center',
    fontSize: 16,
  },
}); */



/* 
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import StoreKitService from '../services/StoreKit';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const UpgradePrompt: React.FC<Props> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const storeKit = StoreKitService.getInstance();

  useEffect(() => {
    const initializeStore = async () => {
      try {
        await storeKit.initialize();
        setProducts(storeKit.getProducts());
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      initializeStore();
    }
  }, [visible]);

  const handlePurchase = async (sku: string) => {
    try {
      await storeKit.purchaseSubscription(sku);
      onClose();
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <ScrollView>
            <View style={styles.featuresContainer}>
              <Text style={styles.subtitle}>Premium Features:</Text>
              <Text style={styles.feature}>• Ad-free experience</Text>
              <Text style={styles.feature}>• Unlimited daily tests</Text>
              <Text style={styles.feature}>• Advanced analytics</Text>
              <Text style={styles.feature}>• Priority support</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : (
              <View style={styles.plansContainer}>
                {products.map((product) => (
                  <TouchableOpacity
                    key={product.productId}
                    style={styles.planButton}
                    onPress={() => handlePurchase(product.productId)}
                  >
                    <Text style={styles.planTitle}>
                      {product.title}
                    </Text>
                    <Text style={styles.planPrice}>
                      {product.localizedPrice}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>
                Continue with free version
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  feature: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
  },
  plansContainer: {
    gap: 10,
  },
  planButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  planTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  planPrice: {
    color: 'white',
    fontSize: 16,
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 16,
  },
});
 */