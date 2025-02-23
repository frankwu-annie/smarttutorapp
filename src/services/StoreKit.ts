import {Linking} from "react-native"
import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product,
  PurchaseError,
  ProductPurchase,
  getAvailablePurchases,
  requestSubscription,
  Purchase,
  clearTransactionIOS,
} from "react-native-iap";
import { auth } from "../config/firebase";

export const subscriptionSkus = [
  "com.neobile.smarttutor.monthly",
  "com.neobile.smarttutor.yearly",
];

class StoreKitService {
  private static instance: StoreKitService;
  private products: Product[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  private constructor() {}

  static getInstance(): StoreKitService {
    if (!StoreKitService.instance) {
      StoreKitService.instance = new StoreKitService();
    }
    return StoreKitService.instance;
  }

  async initialize() {
    try {
      console.log("Initializing IAP connection...");
      if (__DEV__) {
        console.log("Running in development mode");
        console.log("Product IDs to fetch:", subscriptionSkus);
      }

      const result = await initConnection();
      console.log("IAP Connection result:", result);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: ProductPurchase) => {
          console.log("Purchase update received:", purchase);
          const receipt = purchase.transactionReceipt;
          
          if (receipt) {
            try {
              await finishTransaction({ purchase });
              console.log("Transaction finished successfully:", purchase);

              const currentUser = auth.currentUser;
              if (currentUser) {
                // Send receipt to backend for validation
                const validationResponse = await fetch(
                  `https://smart-ai-tutor.com/api/subscription/${currentUser.uid}/validate`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      receipt: receipt,
                      productId: purchase.productId,
                      transactionId: purchase.transactionId,
                      transactionDate: purchase.transactionDate,
                    }),
                  }
                );

                if (!validationResponse.ok) {
                  throw new Error("Failed to validate receipt");
                }

                const validationResult = await validationResponse.json();
                
                // Update status even if receipt is not valid (e.g. expired)
                await this.updateSubscriptionStatus(
                  currentUser.uid,
                  validationResult.status,
                  validationResult.isValid ? purchase.transactionId : null
                );
                
                if (!validationResult.isValid) {
                  console.log("Receipt validation result:", validationResult);
                  // Don't throw error for expired subscriptions
                  return;
                }
              }
            } catch (error) {
              console.error("Failed to process transaction:", error);
              throw error;
            }
          }
        }
      );

      this.purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.error("Purchase error:", error);
          throw error;
        }
      );

      try {
        console.log("Calling getProducts with:", { skus: subscriptionSkus });
        this.products = await getProducts({ skus: subscriptionSkus });
        console.log("Products loaded:", this.products);
        
        if (this.products.length === 0) {
          console.warn("No products available. Checklist:");
          console.warn("1. Product IDs match exactly:", subscriptionSkus);
          console.warn("2. Products are approved in App Store Connect");
          console.warn("3. Bundle ID matches App Store Connect");
          console.warn("4. App is in TestFlight or sandbox testing mode");
        }
      } catch (productError) {
        console.error("Error loading products:", productError);
        throw productError;
      }
    } catch (err) {
      console.error("Failed to initialize IAP:", err);
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      const product = this.products.find((p) => p.productId === sku);
      if (!product) {
        throw new Error(`Product ${sku} not found`);
      }
      await requestPurchase({ sku });
    } catch (err) {
      console.error("Purchase failed:", err);
      throw err;
    }
  }

  private async updateSubscriptionStatus(
    userId: string,
    status: string,
    subscriptionId: string | null
  ): Promise<void> {
    const response = await fetch(
      `https://smart-ai-tutor.com/api/subscription/${userId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          subscriptionId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update subscription status on backend");
    }
  }

  async verifySubscriptionStatus(): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("No user logged in, skipping subscription verification");
        return;
      }

      console.log("Verifying subscription status for user:", currentUser.uid);
      // Force refresh purchases to get latest status
      //await clearTransactionIOS();
      const purchases = await getAvailablePurchases();
      console.log("Available purchases:", purchases);

      const latestSubscription = purchases
        .filter((purchase: Purchase) => subscriptionSkus.includes(purchase.productId))
        .sort((a: Purchase, b: Purchase) => 
          (b.transactionDate || 0) - (a.transactionDate || 0)
        )[0];

      if (!latestSubscription?.transactionReceipt) {
        console.log("No valid subscription receipt found");
        await this.updateSubscriptionStatus(currentUser.uid, "free", null);
        return;
      }

      const validationResponse = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${currentUser.uid}/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: latestSubscription.transactionReceipt,
            productId: latestSubscription.productId,
            transactionId: latestSubscription.transactionId,
            transactionDate: latestSubscription.transactionDate,
          }),
        }
      );

      if (!validationResponse.ok) {
        throw new Error("Failed to validate subscription receipt");
      }

      const validationResult = await validationResponse.json();
      await this.updateSubscriptionStatus(
        currentUser.uid,
        validationResult.status,
        validationResult.isValid ? latestSubscription.transactionId : null
      );
    } catch (error) {
      console.error("Error verifying subscription status:", error);
      throw error;
    }
  }

  async openSubscriptionManagement(): Promise<void> {
    try {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
    } catch (error) {
      console.error("Failed to open subscription management:", error);
      throw error;
    }
  }

  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
  }
}

export default StoreKitService;

/* import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product,
  PurchaseError,
  ProductPurchase,
  getAvailablePurchases,
  requestSubscription,
  Purchase,
  
} from "react-native-iap";

import { auth } from "../config/firebase";

export const subscriptionSkus = [
  "com.neobile.smarttutor.monthly",
  "com.neobile.smarttutor.yearly",
];

class StoreKitService {
  private static instance: StoreKitService;
  private products: Product[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  private constructor() {}

  static getInstance(): StoreKitService {
    if (!StoreKitService.instance) {
      StoreKitService.instance = new StoreKitService();
    }
    return StoreKitService.instance;
  }

  async initialize() {
    try {
      console.log("Initializing IAP connection...");
      if (__DEV__) {
        console.log("Running in development mode");
        console.log("Product IDs to fetch:", subscriptionSkus);
      }

      const result = await initConnection();
      console.log("IAP Connection result:", result);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: ProductPurchase) => {
          console.log("Purchase update received:", purchase);
          const receipt = purchase.transactionReceipt;
          
          if (receipt) {
            try {
              await finishTransaction({ purchase });
              console.log("Transaction finished successfully:", purchase);

              const currentUser = auth.currentUser;
              if (currentUser) {
                // Send receipt to backend for validation
                const validationResponse = await fetch(
                  `https://smart-ai-tutor.com/api/subscription/${currentUser.uid}/validate`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      receipt: receipt,
                      productId: purchase.productId,
                      transactionId: purchase.transactionId,
                      transactionDate: purchase.transactionDate,
                    }),
                  }
                );

                if (!validationResponse.ok) {
                  throw new Error("Failed to validate receipt");
                }

                const validationResult = await validationResponse.json();
                
                if (!validationResult.isValid) {
                  throw new Error("Invalid receipt");
                }

                await this.updateSubscriptionStatus(
                  currentUser.uid,
                  validationResult.status,
                  purchase.transactionId
                );
              }
            } catch (error) {
              console.error("Failed to process transaction:", error);
              throw error;
            }
          }
        }
      );

      this.purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.error("Purchase error:", error);
          throw error;
        }
      );

      try {
        console.log("Calling getProducts with:", { skus: subscriptionSkus });
        this.products = await getProducts({ skus: subscriptionSkus });
        console.log("Products loaded:", this.products);
        
        if (this.products.length === 0) {
          console.warn("No products available. Checklist:");
          console.warn("1. Product IDs match exactly:", subscriptionSkus);
          console.warn("2. Products are approved in App Store Connect");
          console.warn("3. Bundle ID matches App Store Connect");
          console.warn("4. App is in TestFlight or sandbox testing mode");
        }
      } catch (productError) {
        console.error("Error loading products:", productError);
        throw productError;
      }
    } catch (err) {
      console.error("Failed to initialize IAP:", err);
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      const product = this.products.find((p) => p.productId === sku);
      if (!product) {
        throw new Error(`Product ${sku} not found`);
      }
      await requestPurchase({ sku });
    } catch (err) {
      console.error("Purchase failed:", err);
      throw err;
    }
  }

  private async updateSubscriptionStatus(
    userId: string,
    status: string,
    subscriptionId: string | null
  ): Promise<void> {
    const response = await fetch(
      `https://smart-ai-tutor.com/api/subscription/${userId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          subscriptionId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update subscription status on backend");
    }
  }

  async verifySubscriptionStatus(): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("No user logged in, skipping subscription verification");
        return;
      }

      console.log("Verifying subscription status for user:", currentUser.uid);
      const purchases = await getAvailablePurchases();
      console.log("Available purchases:", purchases);

      const latestSubscription = purchases
        .filter((purchase: Purchase) => subscriptionSkus.includes(purchase.productId))
        .sort((a: Purchase, b: Purchase) => 
          (b.transactionDate || 0) - (a.transactionDate || 0)
        )[0];

      if (!latestSubscription?.transactionReceipt) {
        console.log("No valid subscription receipt found");
        await this.updateSubscriptionStatus(currentUser.uid, "free", null);
        return;
      }

      console.log("latest latestSubscription: ", latestSubscription.transactionReceipt);

      const validationResponse = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${currentUser.uid}/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: latestSubscription.transactionReceipt,
            productId: latestSubscription.productId,
            transactionId: latestSubscription.transactionId,
            transactionDate: latestSubscription.transactionDate,
          }),
        }
      );

      if (!validationResponse.ok) {
        throw new Error("Failed to validate subscription receipt");
      }

      const validationResult = await validationResponse.json();
      await this.updateSubscriptionStatus(
        currentUser.uid,
        validationResult.status,
        validationResult.isValid ? latestSubscription.transactionId : null
      );
    } catch (error) {
      console.error("Error verifying subscription status:", error);
      throw error;
    }
  }

  async openSubscriptionManagement(): Promise<void> {
    try {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
    } catch (error) {
      console.error("Failed to open subscription management:", error);
      throw error;
    }
  }

  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
  }
}

export default StoreKitService; */

/* import { Linking } from "react-native";
import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product,
  PurchaseError,
  ProductPurchase,
  getAvailablePurchases,
  requestSubscription,
  Purchase,
} from "react-native-iap";
import { auth } from "../config/firebase";

// Product IDs for your iOS subscriptions
export const subscriptionSkus = [
  "com.neobile.smarttutor.monthly",
  "com.neobile.smarttutor.yearly",
];

class StoreKitService {
  private static instance: StoreKitService;
  private products: Product[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  private constructor() {}

  static getInstance(): StoreKitService {
    if (!StoreKitService.instance) {
      StoreKitService.instance = new StoreKitService();
    }
    return StoreKitService.instance;
  }

  async initialize() {
    try {
      console.log("Initializing IAP connection...");
      if (__DEV__) {
        console.log("Running in development mode");
        console.log("Product IDs to fetch:", subscriptionSkus);
      }
      
      await this.verifySubscriptionStatus();

      const result = await initConnection();
      console.log("IAP Connection result:", result);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Requesting products with SKUs:", subscriptionSkus);

      this.purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: ProductPurchase) => {
          console.log("Purchase update received:", purchase);
          const receipt = purchase.transactionReceipt;
          
          if (receipt) {
            try {
              await finishTransaction({ purchase });
              console.log("Transaction finished successfully:", purchase);

              const currentUser = auth.currentUser;
              if (currentUser) {
                const response = await fetch(
                  "https://smart-ai-tutor.com/api/subscription/" + currentUser.uid,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: "premium",
                      subscriptionId: purchase.transactionId,
                    }),
                  }
                );
                
                if (!response.ok) {
                  console.error("Failed to update subscription status in backend");
                  throw new Error("Failed to update subscription status");
                }
                
                console.log("Subscription status updated in backend");
              }
            } catch (finishError) {
              console.error("Failed to process transaction:", finishError);
              throw finishError;
            }
          } else {
            console.warn("Purchase received without receipt");
          }
        }
      );

      this.purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.error("Purchase error:", error);
          throw error;
        }
      );

      try {
        console.log("Calling getProducts with:", { skus: subscriptionSkus });
        this.products = await getProducts({ skus: subscriptionSkus });
        console.log("Products loaded:", this.products);
        
        if (this.products.length === 0) {
          console.warn("No products available. Checklist:");
          console.warn("1. Product IDs match exactly:", subscriptionSkus);
          console.warn("2. Products are approved in App Store Connect");
          console.warn("3. Bundle ID matches App Store Connect");
          console.warn("4. App is in TestFlight or sandbox testing mode");
        }
      } catch (productError) {
        console.error("Error loading products:", productError);
        throw productError;
      }
    } catch (err) {
      console.error("Failed to initialize IAP:", err);
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      const product = this.products.find((p) => p.productId === sku);
      if (!product) {
        throw new Error(`Product ${sku} not found`);
      }
      await requestPurchase({ sku });
    } catch (err) {
      console.error("Purchase failed:", err);
      throw err;
    }
  }

  async verifySubscriptionStatus(): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("No user logged in, skipping subscription verification");
        return;
      }

      console.log("Verifying subscription status for user:", currentUser.uid);
      const purchases = await getAvailablePurchases();
      console.log("Available purchases:", purchases);

      const activeSubscription = purchases
        .filter((purchase: Purchase) => subscriptionSkus.includes(purchase.productId))
        .sort((a: Purchase, b: Purchase) => 
          (b.transactionDate || 0) - (a.transactionDate || 0)
        )[0];

      const status = activeSubscription ? "premium" : "free";
      console.log("Determined subscription status:", status);

      const response = await fetch(
        `https://smart-ai-tutor.com/api/subscription/${currentUser.uid}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            subscriptionId: activeSubscription?.transactionId || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update subscription status on backend");
      }

      console.log("Successfully verified and updated subscription status");
    } catch (error) {
      console.error("Error verifying subscription status:", error);
      throw error;
    }
  }

  async openSubscriptionManagement(): Promise<void> {
    try {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
    } catch (error) {
      console.error("Failed to open subscription management:", error);
      throw error;
    }
  }

  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
  }
}

export default StoreKitService; */



/* import { Linking } from "react-native";
import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product,
  PurchaseError,
  ProductPurchase,
  getAvailablePurchases,
  requestSubscription,
  Purchase,
} from "react-native-iap";
import { auth } from "../config/firebase";

// Product IDs for your iOS subscriptions
export const subscriptionSkus = [
  "com.neobile.smarttutor.monthly",
  "com.neobile.smarttutor.yearly",
];

class StoreKitService {
  private static instance: StoreKitService;
  private products: Product[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  private constructor() {}

  static getInstance(): StoreKitService {
    if (!StoreKitService.instance) {
      StoreKitService.instance = new StoreKitService();
    }
    return StoreKitService.instance;
  }

  async initialize() {
    try {
      console.log("Initializing IAP connection...");
      if (__DEV__) {
        console.log("Running in development mode");
        console.log("Product IDs to fetch:", subscriptionSkus);
      }

      const result = await initConnection();
      console.log("IAP Connection result:", result);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Requesting products with SKUs:", subscriptionSkus);

      // Set up purchase listeners
      this.purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: ProductPurchase) => {
          console.log("Purchase update received:", purchase);
          const receipt = purchase.transactionReceipt;
          
          if (receipt) {
            try {
              // First finish the transaction
              await finishTransaction({ purchase });
              console.log("Transaction finished successfully:", purchase);

              // Only after successful transaction, update subscription status
              const currentUser = auth.currentUser;
              if (currentUser) {
                const response = await fetch(
                  "https://smart-ai-tutor.com/api/subscription/" + currentUser.uid,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: "premium",
                      subscriptionId: purchase.transactionId,
                    }),
                  }
                );
                
                if (!response.ok) {
                  console.error("Failed to update subscription status in backend");
                  throw new Error("Failed to update subscription status");
                }
                
                console.log("Subscription status updated in backend");
              }
            } catch (finishError) {
              console.error("Failed to process transaction:", finishError);
              throw finishError;
            }
          } else {
            console.warn("Purchase received without receipt");
          }
        }
      );

      this.purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.error("Purchase error:", error);
          throw error;
        }
      );

      try {
        console.log("Calling getProducts with:", { skus: subscriptionSkus });
        this.products = await getProducts({ skus: subscriptionSkus });
        console.log("Products loaded:", this.products);
        
        if (this.products.length === 0) {
          console.warn("No products available. Checklist:");
          console.warn("1. Product IDs match exactly:", subscriptionSkus);
          console.warn("2. Products are approved in App Store Connect");
          console.warn("3. Bundle ID matches App Store Connect");
          console.warn("4. App is in TestFlight or sandbox testing mode");
        }
      } catch (productError) {
        console.error("Error loading products:", productError);
        throw productError;
      }
    } catch (err) {
      console.error("Failed to initialize IAP:", err);
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      const product = this.products.find((p) => p.productId === sku);
      if (!product) {
        throw new Error(`Product ${sku} not found`);
      }
      // Only initiate the purchase - don't update any state here
      await requestPurchase({ sku });
    } catch (err) {
      console.error("Purchase failed:", err);
      throw err;
    }
  }

  async openSubscriptionManagement(): Promise<void> {
    try {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
    } catch (error) {
      console.error("Failed to open subscription management:", error);
      throw error;
    }
  }

  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
  }
}

export default StoreKitService; */

/* import {
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product,
  PurchaseError,
  ProductPurchase,
  getAvailablePurchases,
  requestSubscription,
  Purchase,
} from "react-native-iap";
import { auth } from "../config/firebase";

// Product IDs for your iOS subscriptions
export const subscriptionSkus = [
  "com.neobile.smarttutor.monthly",
  "com.neobile.smarttutor.yearly",
];

class StoreKitService {
  private static instance: StoreKitService;
  private products: Product[] = [];
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  private constructor() {}

  static getInstance(): StoreKitService {
    if (!StoreKitService.instance) {
      StoreKitService.instance = new StoreKitService();
    }
    return StoreKitService.instance;
  }

  async initialize() {
    try {
      console.log("Initializing IAP connection...");
      // Enable more detailed logging for development
      if (__DEV__) {
        console.log("Running in development mode");
        console.log("Product IDs to fetch:", subscriptionSkus);
      }

      const result = await initConnection();
      console.log("IAP Connection result:", result);

      // Add delay to ensure connection is established
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Requesting products with SKUs:", subscriptionSkus);

      // Set up purchase listeners
      this.purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: ProductPurchase) => {
          const receipt = purchase.transactionReceipt;
          if (receipt) {
            try {
              await finishTransaction({ purchase });
              console.log("Transaction finished:", purchase);

              // Update subscription status in database
              const currentUser = auth.currentUser;
              if (currentUser) {
                await fetch(
                  "https://smart-ai-tutor.com/api/subscription/" +
                    currentUser.uid,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: "premium",
                      subscriptionId: purchase.transactionId,
                    }),
                  },
                );
              }
            } catch (finishError) {
              console.error("Failed to finish transaction:", finishError);
            }
          }
        },
      );

      this.purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          console.error("Purchase error:", error);
        },
      );

      // Load products
      console.log("Attempting to load products...");
      try {
        console.log("Calling getProducts with:", { skus: subscriptionSkus });
        this.products = await getProducts({ skus: subscriptionSkus });
        console.log("Raw products response:", this.products);
        console.log("Available products:", this.products);
        console.log("Product details:", JSON.stringify(this.products, null, 2));
        console.log("StoreKit configuration status:", {
          connectionResult: result,
          productCount: this.products.length,
          requestedSkus: subscriptionSkus,
          productIds: this.products.map((p) => p.productId),
        });
      } catch (productError) {
        console.error("Error loading products:", {
          error: productError,
          message: productError.message,
          code: productError.code,
          stack: productError.stack,
        });
      }

      if (this.products.length === 0) {
        console.warn("No products available. Checklist:");
        console.warn("1. Product IDs match exactly:", subscriptionSkus);
        console.warn("2. Products are approved in App Store Connect");
        console.warn("3. Bundle ID matches App Store Connect");
        console.warn("4. App is in TestFlight or sandbox testing mode");
      }
    } catch (err) {
      console.error("Failed to initialize IAP:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      const product = this.products.find((p) => p.productId === sku);
      if (!product) {
        throw new Error(`Product ${sku} not found`);
      }
      await requestPurchase({ sku });
    } catch (err) {
      console.error("Purchase failed:", err);
      throw err;
    }
  }

  async cancelSubscription(): Promise<void> {
    try {
      console.log("Starting subscription cancellation process...");

      // Get active subscriptions
      const purchases = await getAvailablePurchases();
      console.log("Current purchases:", purchases);

      if (!purchases || purchases.length === 0) {
        throw new Error("No active subscriptions found");
      }

      // Find the most recent active subscription
      const activeSubscription = purchases
        .filter((purchase: Purchase) =>
          subscriptionSkus.includes(purchase.productId),
        )
        .sort(
          (a: Purchase, b: Purchase) =>
            (b.transactionDate || 0) - (a.transactionDate || 0),
        )[0];

      if (!activeSubscription) {
        throw new Error("No active subscription found to cancel");
      }

      console.log(
        "Found active subscription:",
        activeSubscription.transactionId,
      );

      // Request subscription cancellation through App Store
      const result = await requestSubscription({
        sku: activeSubscription.productId,
        subscriptionOffers: [
          {
            offerToken: activeSubscription.transactionId,
          },
        ],
      });

      console.log("Cancellation result:", result);

      if (!result) {
        throw new Error("Failed to cancel subscription");
      }

      // Finish the cancellation transaction
      await finishTransaction({ purchase: activeSubscription });
      console.log("Successfully cancelled subscription");
    } catch (error) {
      console.error("Failed to cancel subscription through IAP:", error);
      throw error;
    }
  }

  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
  }
}

export default StoreKitService; */


