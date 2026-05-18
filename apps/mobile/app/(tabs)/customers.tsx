import { formatCnpjMask, isCnpjComplete } from "@pedidos/shared";
import { UserPlus } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCustomersScreen } from "../../hooks/screens/useCustomersScreen";

export default function CustomersScreen() {
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
          <TextInput
            style={[styles.input, styles.cnpjInput]}
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
              <ActivityIndicator color="#0369a1" />
            ) : (
              <Text style={styles.cnpjBtnText}>Buscar</Text>
            )}
          </Pressable>
        </View>
        {cnpjErr ? <Text style={styles.err}>{cnpjErr}</Text> : null}
        {cnpjOk ? <Text style={styles.ok}>{cnpjOk}</Text> : null}
        <Text style={styles.hint}>Dados públicos via BrasilAPI — pode editar antes de gravar.</Text>
        <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput style={styles.input} placeholder="Telefone" value={phone} onChangeText={setPhone} />
        <Pressable
          style={[styles.btn, !canSubmit && styles.btnOff]}
          disabled={!canSubmit}
          onPress={() => create.mutate()}
        >
          <View style={styles.btnInner}>
            <UserPlus color="#fff" size={18} strokeWidth={2} />
            <Text style={styles.btnText}>Adicionar</Text>
          </View>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 16 }} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  form: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  formTitle: { fontWeight: "600", color: "#0f172a", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginTop: 4 },
  hint: { fontSize: 11, color: "#94a3b8", marginBottom: 4 },
  err: { fontSize: 12, color: "#dc2626" },
  ok: { fontSize: 12, color: "#059669", fontWeight: "600" },
  cnpjRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  cnpjInput: { flex: 1, fontFamily: "monospace", fontSize: 14 },
  cnpjBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#e0f2fe",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7dd3fc",
    minWidth: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  cnpjBtnText: { fontWeight: "700", color: "#0369a1", fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  btn: {
    marginTop: 4,
    backgroundColor: "#0284c7",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnOff: { opacity: 0.5 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
  list: { padding: 12, paddingBottom: 32 },
  card: {
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 14, color: "#64748b", marginTop: 4 },
  finHint: { marginTop: 10, fontSize: 12, fontWeight: "600", color: "#0369a1" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 24 },
});
