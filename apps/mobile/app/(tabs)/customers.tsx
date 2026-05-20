import { formatCnpjMask, isCnpjComplete } from "@pedidos/shared";
import { UserPlus } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemedTextInput } from "../../components/atoms/ThemedTextInput";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { useCustomersScreen } from "../../hooks/screens/useCustomersScreen";
import { useTheme } from "../../lib/theme";
import type { AppColors } from "../../lib/theme/types";

export default function CustomersScreen() {
  const styles = useThemedStyles(createCustomersStyles);
  const { colors } = useTheme();
  const {
    customers,
    isLoading,
    isRefetching,
    refetch,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    cnpjDigits,
    onCnpjChange,
    cnpjLoading,
    cnpjErr,
    cnpjOk,
    lookupCnpj,
    create,
    openCustomer,
    canSubmit,
  } = useCustomersScreen();

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.formTitle}>Novo cliente</Text>
        <Text style={styles.label}>CNPJ (opcional · PJ)</Text>
        <View style={styles.cnpjRow}>
          <ThemedTextInput
            style={[styles.cnpjInput]}
            placeholder="00.000.000/0001-00"
            keyboardType="number-pad"
            value={formatCnpjMask(cnpjDigits)}
            editable={!cnpjLoading}
            onChangeText={onCnpjChange}
          />
          <Pressable
            style={[styles.cnpjBtn, (!isCnpjComplete(cnpjDigits) || cnpjLoading) && styles.btnOff]}
            disabled={!isCnpjComplete(cnpjDigits) || cnpjLoading}
            onPress={() => void lookupCnpj()}
          >
            {cnpjLoading ? (
              <ActivityIndicator color={colors.link} />
            ) : (
              <Text style={styles.cnpjBtnText}>Buscar</Text>
            )}
          </Pressable>
        </View>
        {cnpjErr ? <Text style={styles.err}>{cnpjErr}</Text> : null}
        {cnpjOk ? <Text style={styles.ok}>{cnpjOk}</Text> : null}
        <Text style={styles.hint}>Dados públicos via BrasilAPI — pode editar antes de gravar.</Text>
        <ThemedTextInput placeholder="Nome" value={name} onChangeText={setName} />
        <ThemedTextInput
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <ThemedTextInput placeholder="Telefone" value={phone} onChangeText={setPhone} />
        <Pressable
          style={[styles.btn, !canSubmit && styles.btnOff]}
          disabled={!canSubmit}
          onPress={() => create.mutate()}
        >
          <View style={styles.btnInner}>
            <UserPlus color={colors.primaryForeground} size={18} strokeWidth={2} />
            <Text style={styles.btnText}>Adicionar</Text>
          </View>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum cliente.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openCustomer(item.id)}>
              <Text style={styles.name}>{item.name}</Text>
              {item.email ? <Text style={styles.meta}>{item.email}</Text> : null}
              {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
              <Text style={styles.finHint}>Toque para ver limite e títulos</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function createCustomersStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    form: {
      padding: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 8,
    },
    formTitle: { fontWeight: "600", color: c.text, marginBottom: 4 },
    label: { fontSize: 13, fontWeight: "600", color: c.textSecondary, marginTop: 4 },
    hint: { fontSize: 11, color: c.textMuted, marginBottom: 4 },
    err: { fontSize: 12, color: c.danger },
    ok: { fontSize: 12, color: c.success, fontWeight: "600" },
    cnpjRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    cnpjInput: { flex: 1, fontFamily: "monospace", fontSize: 14 },
    cnpjBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.primaryMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.primary,
      minWidth: 88,
      alignItems: "center",
      justifyContent: "center",
    },
    cnpjBtnText: { fontWeight: "700", color: c.link, fontSize: 14 },
    btn: {
      marginTop: 4,
      backgroundColor: c.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    btnOff: { opacity: 0.5 },
    btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    btnText: { color: c.primaryForeground, fontWeight: "600" },
    list: { padding: 12, paddingBottom: 32 },
    card: {
      padding: 14,
      backgroundColor: c.card,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    name: { fontSize: 16, fontWeight: "600", color: c.text },
    meta: { fontSize: 14, color: c.textSecondary, marginTop: 4 },
    finHint: { marginTop: 10, fontSize: 12, fontWeight: "600", color: c.link },
    empty: { textAlign: "center", color: c.textMuted, marginTop: 24 },
  });
}
