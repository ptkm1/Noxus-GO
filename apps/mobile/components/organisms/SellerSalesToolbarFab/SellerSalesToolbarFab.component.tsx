import { Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSellerSalesToolbarFabStyles } from "./SellerSalesToolbarFab.styles";

export function SellerSalesToolbarFab(props: {
  onQuickSale: () => void;
  fabBackgroundColor?: string;
}) {
  const styles = useSellerSalesToolbarFabStyles({ fabBackgroundColor: props.fabBackgroundColor });

  return (
    <View style={styles.toolbar}>
      <Pressable style={styles.fab} onPress={props.onQuickSale}>
        <View style={styles.fabInner}>
          <Plus color="#fff" size={18} strokeWidth={2.5} />
          <Text style={styles.fabText}>Venda rápida</Text>
        </View>
      </Pressable>
    </View>
  );
}
