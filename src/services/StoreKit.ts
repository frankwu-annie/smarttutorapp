import { 
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product,
  PurchaseError
} from 'react-native-iap';

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
      await initConnection();

      // Set up purchase listeners
      this.purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          // Validate receipt with your backend here if needed
          await finishTransaction({ purchase });
        }
      });

      this.purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
        console.error('Purchase error:', error);
        throw error;
      });

      // Load products
      this.products = await getProducts({ skus: subscriptionSkus });
      console.log('Available products:', this.products);
    } catch (err) {
      console.error('Failed to initialize IAP:', err);
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      if (!this.products.find(p => p.productId === sku)) {
        throw new Error('Invalid product SKU');
      }
      await requestPurchase({ sku });
    } catch (err) {
      console.error('Purchase failed:', err);
      throw err;
    }
  }

  // Clean up method to be called when the app is closed or the service is no longer needed
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


/* import { Platform } from 'react-native';
import { 
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  getProducts,
  requestPurchase,
  finishTransaction,
  Product
} from 'react-native-iap';

// Product IDs for your subscriptions
export const subscriptionSkus = Platform.select({
  ios: [
    'com.neobile.smarttutor.monthly',
    'com.neobile.smarttutor.yearly'
  ],
  android: [] // Add Android SKUs if needed in the future
});

class StoreKitService {
  private static instance: StoreKitService;
  private products: Product[] = [];

  private constructor() {}

  static getInstance(): StoreKitService {
    if (!StoreKitService.instance) {
      StoreKitService.instance = new StoreKitService();
    }
    return StoreKitService.instance;
  }

  async initialize() {
    try {
      await initConnection();
      // Set up purchase listeners
      purchaseUpdatedListener(async (purchase) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          await finishTransaction({ purchase });
        }
      });

      purchaseErrorListener((error) => {
        console.error('Purchase error:', error);
      });

      // Load products
      if (subscriptionSkus) {
        this.products = await getProducts({ skus: subscriptionSkus });
      }
    } catch (err) {
      console.error('Failed to initialize IAP:', err);
      throw err;
    }
  }

  getProducts(): Product[] {
    return this.products;
  }

  async purchaseSubscription(sku: string): Promise<void> {
    try {
      await requestPurchase({ sku });
    } catch (err) {
      console.error('Purchase failed:', err);
      throw err;
    }
  }
}

export default StoreKitService;
 */