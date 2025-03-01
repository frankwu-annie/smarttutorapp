import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  subscriptionOptions: SubscriptionOption[];
  onSubscribe: (sku: string) => void;
  loadingSubscription: boolean;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  visible,
  onClose,
  subscriptionOptions,
  onSubscribe,
  loadingSubscription,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, styles.subscriptionModal]}>
          <Text style={styles.modalTitle}>Upgrade to Premium</Text>
          <Text style={styles.subscriptionDescription}>
            Get unlimited access to all our premium features!
          </Text>

          <View style={styles.featuresList}>

            <Text style={styles.featureItem}>✓ Unlimited daily tests</Text>
            <Text style={styles.featureItem}>
              ✓ Advanced progress tracking
            </Text>
            {/* <Text style={styles.featureItem}>✓ Ad-free experience</Text> */}
            <Text style={styles.featureItem}>✓ Priority support</Text>
          </View>

          <Text style={styles.cancelNote}>
            Cancel anytime. No commitment required.
          </Text>

          <View style={styles.subscriptionOptionsContainer}>
            {subscriptionOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.subscriptionOption,
                  loadingSubscription && styles.buttonDisabled,
                  option.sku.includes("yearly") && styles.yearlyOption,
                ]}
                onPress={() => onSubscribe(option.sku)}
                disabled={loadingSubscription}
              >
                <View>
                  <Text style={styles.optionPeriod}>
                    {option.sku.includes("yearly") ? "Yearly" : "Monthly"}
                  </Text>
                  <Text style={styles.optionPrice}>{option.price}</Text>
                  {option.sku.includes("yearly") && (
                    <Text style={styles.savingsText}>
                      Save {(() => {
                        try {
                          const yearlyPrice = parseFloat(option.price.replace(/[^0-9.]/g, ''));
                          const monthlyOption = subscriptionOptions.find(opt => opt.sku.includes('monthly'));
                          if (!monthlyOption) return '66%';
                          
                          const monthlyPrice = parseFloat(monthlyOption.price.replace(/[^0-9.]/g, ''));
                          const yearlyMonthlyEquivalent = yearlyPrice / 12;
                          const savingsPercent = Math.round(((monthlyPrice - yearlyMonthlyEquivalent) / monthlyPrice) * 100);
                          
                          return isNaN(savingsPercent) ? '66%' : `${savingsPercent}%`;
                        } catch (error) {
                          return '66%';
                        }
                      })()}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default UpgradePrompt;

const styles = StyleSheet.create({
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
  subscriptionModal: {
    width: "90%",
    maxHeight: "80%",
  },
  subscriptionDescription: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    fontSize: 16,
    marginBottom: 10,
    color: "#333",
  },
  cancelNote: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  subscriptionOptionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  subscriptionOption: {
    backgroundColor: "#007AFF",
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 5,
    flex: 1,
    alignItems: "center",
  },
  // Added yearlyOption style
  yearlyOption: {
    backgroundColor: "#4CAF50",
  },
  optionPeriod: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  optionPrice: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  savingsText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 5,
    fontWeight: "500",
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
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});


/* import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export interface SubscriptionOption {
  sku: string;
  title: string;
  price: string;
  period: string;
  description: string;
}

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  subscriptionOptions: SubscriptionOption[];
  onSubscribe: (sku: string) => void;
  loadingSubscription: boolean;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  visible,
  onClose,
  subscriptionOptions,
  onSubscribe,
  loadingSubscription,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, styles.subscriptionModal]}>
          <Text style={styles.modalTitle}>Upgrade to Premium</Text>
          <Text style={styles.subscriptionDescription}>
            Get unlimited access to all our premium features!
          </Text>

          <View style={styles.featuresList}>
            
            <Text style={styles.featureItem}>✓ Unlimited daily tests</Text>
            <Text style={styles.featureItem}>
              ✓ Advanced progress tracking
            </Text>
            
            <Text style={styles.featureItem}>✓ Priority support</Text>
          </View>

          <Text style={styles.cancelNote}>
            Cancel anytime. No commitment required.
          </Text>

          <View style={styles.subscriptionOptionsContainer}>
            {subscriptionOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.subscriptionOption,
                  loadingSubscription && styles.buttonDisabled,
                  option.sku.includes("yearly") && styles.yearlyOption,
                ]}
                onPress={() => onSubscribe(option.sku)}
                disabled={loadingSubscription}
              >
                <View>
                  <Text style={styles.optionPeriod}>
                    {option.sku.includes("yearly") ? "Yearly" : "Monthly"}
                  </Text>
                  <Text style={styles.optionPrice}>{option.price}</Text>
                  {option.sku.includes("yearly") && (
                    <Text style={styles.savingsText}>Save 66%</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default UpgradePrompt;

const styles = StyleSheet.create({
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
  subscriptionModal: {
    width: "90%",
    maxHeight: "80%",
  },
  subscriptionDescription: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    fontSize: 16,
    marginBottom: 10,
    color: "#333",
  },
  cancelNote: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  subscriptionOptionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  subscriptionOption: {
    backgroundColor: "#007AFF",
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 5,
    flex: 1,
    alignItems: "center",
  },
  // Added yearlyOption style
  yearlyOption: {
    backgroundColor: "#4CAF50",
  },
  optionPeriod: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  optionPrice: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  savingsText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 5,
    fontWeight: "500",
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
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}); */

