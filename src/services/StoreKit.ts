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

export default StoreKitService;

/* 
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
} from 'react-native-iap';
import { auth } from '../config/firebase';

// Product IDs for your iOS subscriptions
export const subscriptionSkus = [
  'com.neobile.smarttutor.monthly',
  'com.neobile.smarttutor.yearly'
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
      console.log('Initializing IAP connection...');
      // Enable more detailed logging for development
      if (__DEV__) {
        console.log('Running in development mode');
        console.log('Product IDs to fetch:', subscriptionSkus);
      }
      
      const result = await initConnection();
      console.log('IAP Connection result:', result);
      
      // Add delay to ensure connection is established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Requesting products with SKUs:', subscriptionSkus);

      // Set up purchase listeners
      this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          try {
            await finishTransaction({ purchase });
            console.log('Transaction finished:', purchase);
            
            // Update subscription status in database
            const currentUser = auth.currentUser;
            if (currentUser) {
              await fetch('https://smart-ai-tutor.com/api/subscription/' + currentUser.uid, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  status: 'premium',
                  subscriptionId: purchase.transactionId
                })
              });
            }
          } catch (finishError) {
            console.error('Failed to finish transaction:', finishError);
          }
        }
      });

      this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
        console.error('Purchase error:', error);
      });

      // Load products
      console.log('Attempting to load products...');
      try {
        console.log('Calling getProducts with:', { skus: subscriptionSkus });
        this.products = await getProducts({ skus: subscriptionSkus });
        console.log('Raw products response:', this.products);
        console.log('Available products:', this.products);
        console.log('Product details:', JSON.stringify(this.products, null, 2));
        console.log('StoreKit configuration status:', {
          connectionResult: result,
          productCount: this.products.length,
          requestedSkus: subscriptionSkus,
          productIds: this.products.map(p => p.productId)
        });
      } catch (productError) {
        console.error('Error loading products:', {
          error: productError,
          message: productError.message,
          code: productError.code,
          stack: productError.stack
        });
      }

      if (this.products.length === 0) {
        console.warn('No products available. Checklist:');
        console.warn('1. Product IDs match exactly:', subscriptionSkus);
        console.warn('2. Products are approved in App Store Connect');
        console.warn('3. Bundle ID matches App Store Connect');
        console.warn('4. App is in TestFlight or sandbox testing mode');
      }
    } catch (err) {
      console.error('Failed to initialize IAP:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      const product = this.products.find(p => p.productId === sku);
      if (!product) {
        throw new Error(`Product ${sku} not found`);
      }
      await requestPurchase({ sku });
    } catch (err) {
      console.error('Purchase failed:', err);
      throw err;
    }
  }

  async cancelSubscription(): Promise<void> {
    try {
      // Add proper IAP cancellation logic here when available
      // For now, we'll just simulate the cancellation
      console.log('Cancelling subscription through IAP...');
      // Implementation will depend on the IAP library's capabilities
      // This is a placeholder for the actual implementation
      throw new Error('IAP cancellation not yet implemented');
    } catch (error) {
      console.error('Failed to cancel subscription through IAP:', error);
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
 */