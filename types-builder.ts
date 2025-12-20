// PC Builder specific types extending your existing types

export interface BuildComponent {
  category: 'CPU' | 'GPU' | 'Motherboards' | 'RAM' | 'Storage' | 'Power Supply' | 'Cooler' | 'Case';
  product: Product | null;
  required: boolean;
  compatibilityIssues?: string[];
}

export interface PCBuild {
  id: string;
  name: string;
  components: {
    cpu: BuildComponent;
    gpu: BuildComponent;
    motherboard: BuildComponent;
    ram: BuildComponent;
    storage: BuildComponent;
    psu: BuildComponent;
    cooler: BuildComponent;
    case: BuildComponent;
  };
  totalPrice: number;
  compatibilityStatus: 'compatible' | 'warning' | 'incompatible';
  powerRequirement: number;
  created: Date;
  updated: Date;
}

export interface CompatibilityCheck {
  isCompatible: boolean;
  warnings: CompatibilityWarning[];
  errors: CompatibilityError[];
}

export interface CompatibilityWarning {
  component1: string;
  component2: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CompatibilityError {
  component1: string;
  component2: string;
  message: string;
  blocking: boolean;
}