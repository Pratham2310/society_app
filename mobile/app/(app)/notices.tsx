import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";

import { api, type Page } from "../../src/lib/api";
import { colors, radius, space, type } from "../../src/theme";
import { Card, Empty, ErrorNote, Loading, Pill } from "../../src/components/ui";

// =======================================================
// NOTICES
//
// Cursor pagination, which is what the backend serves mobile clients:
// new notices arrive at the head of the list, and offset paging would
// shift rows under the reader's thumb as they scroll.
// =======================================================

interface Notice {
  _id: string;
  title: string;
  description: string;
  type: "notice" | "announcement";
  category?: string;
  isUrgent?: boolean;
  createdAt?: string;
}

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Notices", value: "notice" },
  { label: "Announcements", value: "announcement" },
] as const;

const on = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

export default function NoticesScreen() {

  const [filter, setFilter] = useState<string | undefined>(undefined);

  const query = useInfiniteQuery<Page<Notice>>({
    queryKey: ["notices", filter],
    initialPageParam: undefined as string | undefined,
    // mode=cursor opens the sequence; without it the backend answers
    // with offset paging and never hands back a cursor to follow.
    queryFn: ({ pageParam }) =>
      api.getPage<Notice>("/notices", {
        mode: "cursor",
        limit: 20,
        type: filter,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  const notices = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>

      <Text style={s.title}>Notices</Text>

      <View style={s.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.label}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.value }}
            onPress={() => setFilter(f.value)}
            style={[s.filter, filter === f.value && s.filterOn]}
          >
            <Text style={[s.filterText, filter === f.value && s.filterTextOn]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.gutter}>
        <ErrorNote error={query.error} />
      </View>

      {query.isLoading ? <Loading /> : (
        <FlatList
          data={notices}
          keyExtractor={(n) => n._id}
          contentContainerStyle={s.list}
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          ListEmptyComponent={<Empty>Nothing posted yet.</Empty>}
          ListFooterComponent={query.isFetchingNextPage ? <Loading /> : null}
          renderItem={({ item }) => (
            <Card style={item.isUrgent ? s.urgent : undefined}>
              <View style={s.row}>
                {item.isUrgent && <Pill tone="danger">urgent</Pill>}
                <Pill tone="muted">{item.category ?? "general"}</Pill>
                <View style={{ flex: 1 }} />
                <Text style={s.date}>{on(item.createdAt)}</Text>
              </View>
              <Text style={s.noticeTitle}>{item.title}</Text>
              <Text style={s.noticeBody}>{item.description}</Text>
            </Card>
          )}
        />
      )}

    </SafeAreaView>
  );

}

const s = StyleSheet.create({

  safe: { flex: 1, backgroundColor: colors.ground },
  gutter: { paddingHorizontal: space.lg },

  title: { ...type.display, color: colors.ink, padding: space.lg, paddingBottom: space.md },

  filters: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  filter: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  filterOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { ...type.small, fontWeight: "600", color: colors.inkSoft },
  filterTextOn: { color: colors.white },

  list: { padding: space.lg, paddingTop: 0, gap: space.md },
  urgent: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  row: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  date: { ...type.small, color: colors.muted },
  noticeTitle: { ...type.heading, color: colors.ink, marginTop: space.sm },
  noticeBody: { ...type.body, color: colors.inkSoft, marginTop: space.xs, lineHeight: 21 },

});
