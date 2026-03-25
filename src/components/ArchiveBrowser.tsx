"use client";

import { useMemo, useState } from "react";
import { formatBytes, type ArchiveKind } from "@/lib/fileUtils";
import {
  MAX_ARCHIVE_ENTRY_BYTES,
  type ArchiveData,
  type ArchiveEntrySummary,
} from "@/lib/archiveUtils";

interface ArchiveBrowserProps {
  archive: ArchiveData;
  archiveName: string;
  onOpenEntry: (entry: ArchiveEntrySummary) => void;
  onExportEntry?: (entry: ArchiveEntrySummary) => void;
  onExportEntries?: (
    entries: ArchiveEntrySummary[],
    suggestedName?: string | null
  ) => void;
}

interface ArchiveTreeNode {
  path: string;
  name: string;
  directory: boolean;
  entry: ArchiveEntrySummary | null;
  children: ArchiveTreeNode[];
  fileCount: number;
}

interface MutableArchiveTreeNode {
  path: string;
  name: string;
  directory: boolean;
  entry: ArchiveEntrySummary | null;
  children: MutableArchiveTreeNode[];
  childMap: Map<string, MutableArchiveTreeNode>;
}

export default function ArchiveBrowser({
  archive,
  archiveName,
  onOpenEntry,
  onExportEntry,
  onExportEntries,
}: ArchiveBrowserProps) {
  const tree = useMemo(() => buildArchiveTree(archive.entries), [archive.entries]);
  const [query, setQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    collectInitialExpandedPaths(tree)
  );
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set()
  );

  const fileEntries = useMemo(
    () => archive.entries.filter((entry) => !entry.directory),
    [archive.entries]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTree = useMemo(
    () => filterTree(tree, normalizedQuery),
    [tree, normalizedQuery]
  );
  const allExportableEntries = useMemo(
    () => collectExportableEntries(tree),
    [tree]
  );
  const forcedExpandedPaths = useMemo(
    () => collectDirectoryPaths(filteredTree),
    [filteredTree]
  );
  const visibleExportableEntries = useMemo(
    () => collectExportableEntries(filteredTree),
    [filteredTree]
  );
  const selectedEntries = useMemo(
    () =>
      fileEntries.filter(
        (entry) => selectedPaths.has(entry.path) && !getBlockedReason(entry)
      ),
    [fileEntries, selectedPaths]
  );

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: "var(--sh-bg)" }}
    >
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--sh-border)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2
              className="text-sm font-medium"
              style={{ color: "var(--sh-text)" }}
            >
              Archive Browser
            </h2>
            <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "var(--sh-text2)" }}
            >
              Browse {fileEntries.length.toLocaleString()} file
              {fileEntries.length === 1 ? "" : "s"} in this{" "}
              {formatArchiveKind(archive.kind)} archive. Click a file to open it
              in a read-only tab, or export a file, folder, or selected set of
              entries.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onExportEntries && fileEntries.length > 0 && (
              <MiniActionButton
                label="Export All"
                onClick={() =>
                  onExportEntries(
                    allExportableEntries,
                    "all"
                  )
                }
                disabled={allExportableEntries.length === 0}
              />
            )}
            <div
              className="text-[11px] font-mono px-2 py-1 rounded"
              style={{
                color: "var(--sh-text2)",
                backgroundColor: "var(--sh-bg2)",
                border: "1px solid var(--sh-border)",
              }}
              title={archiveName}
            >
              {archiveName}
            </div>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter archive entries..."
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{
            color: "var(--sh-text)",
            backgroundColor: "var(--sh-bg2)",
            border: "1px solid var(--sh-border)",
          }}
        />

        {onExportEntries && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span
              className="text-[11px] font-mono"
              style={{ color: "var(--sh-text-muted)" }}
            >
              {selectedEntries.length.toLocaleString()} selected
            </span>
            <div className="flex items-center gap-2">
              <MiniActionButton
                label="Select Visible"
                onClick={() =>
                  setSelectedPaths((prev) => {
                    const next = new Set(prev);
                    for (const entry of visibleExportableEntries) {
                      next.add(entry.path);
                    }
                    return next;
                  })
                }
                disabled={visibleExportableEntries.length === 0}
              />
              <MiniActionButton
                label="Clear"
                onClick={() => setSelectedPaths(new Set())}
                disabled={selectedEntries.length === 0}
              />
              <MiniActionButton
                label="Save Selected"
                onClick={() => onExportEntries(selectedEntries, "selection")}
                disabled={selectedEntries.length === 0}
                accent
              />
            </div>
          </div>
        )}
      </div>

      <div
        className="flex items-center h-8 px-4 text-[11px] font-mono shrink-0"
        style={{
          color: "var(--sh-text-muted)",
          borderBottom: "1px solid var(--sh-border)",
        }}
      >
        <span className="w-10 shrink-0">Pick</span>
        <span className="flex-1">Tree</span>
        <span className="w-24 text-right">Size</span>
        <span className="w-40 text-right">Actions</span>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredTree.length === 0 ? (
          <div
            className="flex h-full items-center justify-center px-6 text-center"
            style={{ color: "var(--sh-text2)" }}
          >
            <div>
              <p className="text-sm">No matching entries</p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--sh-text-muted)" }}
              >
                Try a different path fragment or clear the filter.
              </p>
            </div>
          </div>
        ) : (
          <ArchiveTreeRows
            nodes={filteredTree}
            depth={0}
            expandedPaths={expandedPaths}
            forcedExpandedPaths={forcedExpandedPaths}
            queryActive={normalizedQuery.length > 0}
            selectedPaths={selectedPaths}
            onToggleDirectory={(path) =>
              setExpandedPaths((prev) => {
                const next = new Set(prev);
                if (next.has(path)) {
                  next.delete(path);
                } else {
                  next.add(path);
                }
                return next;
              })
            }
            onToggleSelection={(entry) =>
              setSelectedPaths((prev) => {
                const next = new Set(prev);
                if (next.has(entry.path)) {
                  next.delete(entry.path);
                } else {
                  next.add(entry.path);
                }
                return next;
              })
            }
            onOpenEntry={onOpenEntry}
            onExportEntry={onExportEntry}
            onExportEntries={onExportEntries}
          />
        )}
      </div>
    </div>
  );
}

function ArchiveTreeRows({
  nodes,
  depth,
  expandedPaths,
  forcedExpandedPaths,
  queryActive,
  selectedPaths,
  onToggleDirectory,
  onToggleSelection,
  onOpenEntry,
  onExportEntry,
  onExportEntries,
}: {
  nodes: ArchiveTreeNode[];
  depth: number;
  expandedPaths: Set<string>;
  forcedExpandedPaths: Set<string>;
  queryActive: boolean;
  selectedPaths: Set<string>;
  onToggleDirectory: (path: string) => void;
  onToggleSelection: (entry: ArchiveEntrySummary) => void;
  onOpenEntry: (entry: ArchiveEntrySummary) => void;
  onExportEntry?: (entry: ArchiveEntrySummary) => void;
  onExportEntries?: (
    entries: ArchiveEntrySummary[],
    suggestedName?: string | null
  ) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded =
          node.directory &&
          (queryActive
            ? forcedExpandedPaths.has(node.path)
            : expandedPaths.has(node.path));
        const blockedReason = node.entry ? getBlockedReason(node.entry) : null;
        const exportableEntries = node.directory
          ? collectExportableEntries(node)
          : node.entry && !blockedReason
            ? [node.entry]
            : [];
        const isSelected =
          !node.directory && node.entry
            ? selectedPaths.has(node.entry.path)
            : false;

        return (
          <div key={node.path}>
            <div
              className="flex items-center gap-3 pr-4 transition-colors"
              style={{
                borderBottom: "1px solid var(--sh-border)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--sh-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div className="w-10 shrink-0 flex items-center justify-center">
                {!node.directory && node.entry && !blockedReason && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelection(node.entry!)}
                    className="h-3.5 w-3.5"
                    title={`Select ${node.entry.path}`}
                  />
                )}
              </div>

              <div
                className="flex-1 min-w-0"
                style={{ paddingLeft: 16 + depth * 16 }}
              >
                {node.directory ? (
                  <button
                    className="flex items-center min-w-0 w-full py-2 text-left"
                    style={{ color: "var(--sh-text)" }}
                    onClick={() => onToggleDirectory(node.path)}
                    title={node.path}
                  >
                    <span
                      className="w-4 shrink-0 text-[11px] font-mono"
                      style={{ color: "var(--sh-text-muted)" }}
                    >
                      {isExpanded ? "v" : ">"}
                    </span>
                    <span className="truncate font-mono text-xs">{node.name}</span>
                  </button>
                ) : (
                  <button
                    className="flex items-center min-w-0 w-full py-2 text-left disabled:cursor-default"
                    style={{
                      color: blockedReason ? "var(--sh-text-muted)" : "var(--sh-text)",
                    }}
                    onClick={() => {
                      if (node.entry && !blockedReason) onOpenEntry(node.entry);
                    }}
                    disabled={Boolean(blockedReason)}
                    title={blockedReason ?? node.path}
                  >
                    <span
                      className="w-4 shrink-0 text-[11px] font-mono"
                      style={{ color: "var(--sh-text-muted)" }}
                    >
                      -
                    </span>
                    <span className="truncate font-mono text-xs">{node.name}</span>
                    {node.entry?.encrypted && (
                      <span
                        className="ml-2 px-1 py-0.5 rounded text-[10px] font-mono shrink-0"
                        style={{
                          color: "var(--sh-accent-yellow)",
                          backgroundColor: "var(--sh-bg2)",
                          border: "1px solid var(--sh-border)",
                        }}
                      >
                        enc
                      </span>
                    )}
                  </button>
                )}
              </div>

              <span
                className="w-24 text-right text-xs font-mono shrink-0"
                style={{ color: "var(--sh-text2)" }}
              >
                {node.directory
                  ? `${node.fileCount.toLocaleString()} file${node.fileCount === 1 ? "" : "s"}`
                  : node.entry
                    ? formatBytes(node.entry.size)
                    : ""}
              </span>

              <div className="w-40 flex justify-end gap-2 shrink-0">
                {node.directory ? (
                  onExportEntries && (
                    <MiniActionButton
                      label="Save Folder"
                      onClick={() => onExportEntries(exportableEntries, node.name)}
                      disabled={exportableEntries.length === 0}
                    />
                  )
                ) : blockedReason ? (
                  <StatusBadge label={blockedReason} muted />
                ) : (
                  <>
                    {node.entry?.encrypted && <StatusBadge label="enc" />}
                    {onExportEntry && node.entry && (
                      <MiniActionButton
                        label="Save"
                        onClick={() => onExportEntry(node.entry!)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {node.directory && isExpanded && node.children.length > 0 && (
              <ArchiveTreeRows
                nodes={node.children}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                forcedExpandedPaths={forcedExpandedPaths}
                queryActive={queryActive}
                selectedPaths={selectedPaths}
                onToggleDirectory={onToggleDirectory}
                onToggleSelection={onToggleSelection}
                onOpenEntry={onOpenEntry}
                onExportEntry={onExportEntry}
                onExportEntries={onExportEntries}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function buildArchiveTree(entries: ArchiveEntrySummary[]): ArchiveTreeNode[] {
  const root: MutableArchiveTreeNode = {
    path: "",
    name: "",
    directory: true,
    entry: null,
    children: [],
    childMap: new Map(),
  };

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let parent = root;

    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]!;
      const path = parent.path ? `${parent.path}/${part}` : part;
      const isLeaf = index === parts.length - 1;
      const directory = !isLeaf || entry.directory;

      let child = parent.childMap.get(part);
      if (!child) {
        child = {
          path,
          name: part,
          directory,
          entry: isLeaf ? entry : null,
          children: [],
          childMap: new Map(),
        };
        parent.childMap.set(part, child);
        parent.children.push(child);
      } else if (isLeaf) {
        child.entry = entry;
      }

      parent = child;
    }
  }

  return finalizeTree(root).children;
}

function finalizeTree(node: MutableArchiveTreeNode): ArchiveTreeNode {
  const children = node.children
    .map((child) => finalizeTree(child))
    .sort(compareTreeNodes);
  const fileCount = node.directory
    ? children.reduce((sum, child) => sum + child.fileCount, 0)
    : 1;

  return {
    path: node.path,
    name: node.name,
    directory: node.directory,
    entry: node.entry,
    children,
    fileCount,
  };
}

function filterTree(nodes: ArchiveTreeNode[], query: string): ArchiveTreeNode[] {
  if (!query) return nodes;

  return nodes
    .map((node) => filterTreeNode(node, query))
    .filter((node): node is ArchiveTreeNode => node !== null);
}

function filterTreeNode(
  node: ArchiveTreeNode,
  query: string
): ArchiveTreeNode | null {
  const selfMatches =
    node.path.toLowerCase().includes(query) ||
    node.name.toLowerCase().includes(query);

  if (!node.directory) {
    return selfMatches ? node : null;
  }

  if (selfMatches) {
    return node;
  }

  const children = node.children
    .map((child) => filterTreeNode(child, query))
    .filter((child): child is ArchiveTreeNode => child !== null);

  if (children.length === 0) return null;
  return { ...node, children };
}

function collectDirectoryPaths(nodes: ArchiveTreeNode[]): Set<string> {
  const result = new Set<string>();

  const visit = (node: ArchiveTreeNode) => {
    if (node.directory) {
      result.add(node.path);
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return result;
}

function collectInitialExpandedPaths(nodes: ArchiveTreeNode[]): Set<string> {
  const result = new Set<string>();

  for (const node of nodes) {
    if (!node.directory) continue;
    result.add(node.path);

    let current: ArchiveTreeNode | undefined = node;
    while (
      current &&
      current.children.length === 1 &&
      current.children[0]?.directory
    ) {
      current = current.children[0];
      result.add(current.path);
    }
  }

  return result;
}

function collectExportableEntries(
  input: ArchiveTreeNode[] | ArchiveTreeNode
): ArchiveEntrySummary[] {
  const nodes = Array.isArray(input) ? input : [input];
  const result: ArchiveEntrySummary[] = [];

  const visit = (node: ArchiveTreeNode) => {
    if (node.directory) {
      for (const child of node.children) {
        visit(child);
      }
      return;
    }

    if (node.entry && !getBlockedReason(node.entry)) {
      result.push(node.entry);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return result;
}

function compareTreeNodes(a: ArchiveTreeNode, b: ArchiveTreeNode): number {
  if (a.directory !== b.directory) return a.directory ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function getBlockedReason(entry: ArchiveEntrySummary): string | null {
  if (entry.size > MAX_ARCHIVE_ENTRY_BYTES) {
    return `>${formatBytes(MAX_ARCHIVE_ENTRY_BYTES)}`;
  }
  return null;
}

function formatArchiveKind(kind: ArchiveKind): string {
  switch (kind) {
    case "zip":
      return "ZIP";
    case "jar":
      return "JAR";
    case "war":
      return "WAR";
    case "ear":
      return "EAR";
    case "apk":
      return "APK";
    case "tar":
      return "TAR";
    case "tgz":
      return "TAR.GZ";
    default:
      return "archive";
  }
}

function MiniActionButton({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      className="px-2 py-1 rounded text-[10px] font-mono transition-colors disabled:cursor-default disabled:opacity-50"
      style={{
        color: accent ? "white" : "var(--sh-text2)",
        backgroundColor: accent ? "var(--sh-btn-green)" : "var(--sh-bg2)",
        border: accent
          ? "1px solid var(--sh-btn-green)"
          : "1px solid var(--sh-border)",
      }}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = accent ? "white" : "var(--sh-text)";
        e.currentTarget.style.backgroundColor = accent
          ? "var(--sh-btn-green-hover)"
          : "var(--sh-bg-active)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = accent ? "white" : "var(--sh-text2)";
        e.currentTarget.style.backgroundColor = accent
          ? "var(--sh-btn-green)"
          : "var(--sh-bg2)";
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StatusBadge({
  label,
  muted,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono"
      style={{
        color: muted ? "var(--sh-text-muted)" : "var(--sh-accent-blue)",
        backgroundColor: "var(--sh-bg2)",
        border: "1px solid var(--sh-border)",
      }}
    >
      {label}
    </span>
  );
}
