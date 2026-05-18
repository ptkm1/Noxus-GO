export type {
  RoutePlanMapCoord,
  RoutePlanMapCustomerPin,
  RoutePlanMapProps,
  RoutePlanMapRef,
} from "./RoutePlanMap/RoutePlanMap.types";

import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { RoutePlanMapProps, RoutePlanMapRef } from "./RoutePlanMap/RoutePlanMap.types";

export declare const RoutePlanMap: ForwardRefExoticComponent<
  RoutePlanMapProps & RefAttributes<RoutePlanMapRef>
>;
