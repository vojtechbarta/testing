import { faultConfig, FaultKey } from "./faultConfig";

export function isFaultEnabled(key: FaultKey): boolean {
  return faultConfig[key]?.enabled ?? false;
}

export function getFaultSettings(key: FaultKey) {
  return faultConfig[key];
}

