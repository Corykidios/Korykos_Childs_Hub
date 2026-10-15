import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Copy, 
  Check, 
  Download, 
  Search, 
  X, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  FilePlus,
  BookOpen,
  FileCode,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { ExportDropdown, ExportOption } from './ExportDropdown';
import { 
  exportMindMapSvg, 
  exportMindMapPng, 
  exportMindMapOutlineMarkdown, 
  exportMindMapJson 
} from '../utils/exportUtils';

export interface MindMapDataNode {
  id?: string;
  title: string;
  summary?: string;
  children?: MindMapDataNode[];
}

export interface MindMapCanvasProps {
  mindMap: {
    title: string;
    description?: string;
    children?: MindMapDataNode[];
  };
  onSaveToNote?: (title: string, content: string) => void;
  onRequestCreateMindMap?: () => void;
}

interface ProcessedNode {
  id: string;
  title: string;
  summary?: string;
  level: number;
  branchIndex: number;
  children: ProcessedNode[];
  hasChildren: boolean;
  width: number;
  height: number;
  subtreeHeight: number;
  x: number;
  y: number;
  path: string[];
}

// Sophisticated color themes matching NotebookLM mind map palettes
const BRANCH_PALETTES = [
  {
    // Blue / Lavender (Top branch in NotebookLM)
    curve: '#7c8ba1',
    nodeBg: '#2b3140',
    nodeBorder: '#3f475a',
    leafBg: '#232938',
    leafBorder: '#364052',
    text: '#f1f5f9',
    accent: '#818cf8',
    glow: 'rgba(129, 140, 248, 0.25)',
  },
  {
    // Jade / Forest Green (Middle School / Humanities in NotebookLM)
    curve: '#4a8b78',
    nodeBg: '#1e332b',
    nodeBorder: '#2c5243',
    leafBg: '#182b24',
    leafBorder: '#254639',
    text: '#ecfdf5',
    accent: '#34d399',
    glow: 'rgba(52, 211, 153, 0.25)',
  },
  {
    // Amber / Warm Ochre
    curve: '#926a35',
    nodeBg: '#332718',
    nodeBorder: '#523e25',
    leafBg: '#2a1f13',
    leafBorder: '#44321d',
    text: '#fef3c7',
    accent: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.25)',
  },
  {
    // Cyan / Electric Slate
    curve: '#3a7d8c',
    nodeBg: '#1b2d35',
    nodeBorder: '#2a4855',
    leafBg: '#15242b',
    leafBorder: '#223c47',
    text: '#e0f2fe',
    accent: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.25)',
  },
  {
    // Rose / Crimson
    curve: '#8c4355',
    nodeBg: '#351c24',
    nodeBorder: '#552a39',
    leafBg: '#2b161d',
    leafBorder: '#45212d',
    text: '#ffe4e6',
    accent: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.25)',
  },
  {
    // Violet / Amethyst
    curve: '#785396',
    nodeBg: '#2f1f3b',
    nodeBorder: '#4b2f5d',
    leafBg: '#251930',
    leafBorder: '#3d254c',
    text: '#f3e8ff',
    accent: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.25)',
  },
];

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  mindMap,
  onSaveToNote,
  onRequestCreateMindMap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 80, y: 120, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  // Collapsed nodes set (stored by unique path id)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Node selection & inspection
  const [selectedNode, setSelectedNode] = useState<ProcessedNode | null>(null);

  // Search & Outline Copy
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedOutline, setCopiedOutline] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Clean short titles helper
  const cleanTitle = (t: string) => {
    if (!t) return 'Concept';
    // Clean markdown bullets or citations
    return t.replace(/^[#\-*•0-9.)\s]+/, '').replace(/\[\d+\]/g, '').trim();
  };

  // Build and lay out the hierarchy
  const { rootNode, allVisibleNodes, connections, canvasBounds } = useMemo(() => {
    // 1. Recursive preprocessing
    let idCounter = 0;
    const processRaw = (
      raw: MindMapDataNode,
      level: number,
      bIdx: number,
      path: string[]
    ): ProcessedNode => {
      const currentId = `node-${idCounter++}`;
      const title = cleanTitle(raw.title);
      const currentPath = [...path, title];

      const children = (raw.children || []).map((childRaw, cIdx) =>
        processRaw(
          childRaw,
          level + 1,
          level === 0 ? cIdx : bIdx,
          currentPath
        )
      );

      // Width & height calculation without aggressive truncation
      const isLong = title.length > 28;
      const baseWidth = Math.max(140, Math.min(270, Math.round(title.length * 8.0 + 36)));
      const width = level === 0 ? Math.max(180, Math.min(300, Math.round(title.length * 8.5 + 40))) : baseWidth;
      const height = isLong ? 44 : 38;

      return {
        id: currentId,
        title,
        summary: raw.summary,
        level,
        branchIndex: bIdx,
        children,
        hasChildren: children.length > 0,
        width,
        height,
        subtreeHeight: height,
        x: 0,
        y: 0,
        path: currentPath,
      };
    };

    const root = processRaw(
      {
        title: cleanTitle(mindMap.title) || 'Consolidated Sources',
        summary: mindMap.description,
        children: mindMap.children || [],
      },
      0,
      0,
      []
    );

    // 2. Compute visible subtree vertical height for tidy placement
    const SIBLING_GAP = 12;
    const BRANCH_GAP = 32;

    const computeSubtreeHeight = (node: ProcessedNode): number => {
      const isCollapsed = collapsedNodes.has(node.id);
      const visibleChildren = (!isCollapsed && node.children) ? node.children : [];

      if (visibleChildren.length === 0) {
        node.subtreeHeight = node.height;
        return node.height;
      }

      let total = 0;
      visibleChildren.forEach((child, idx) => {
        const childH = computeSubtreeHeight(child);
        total += childH;
        if (idx < visibleChildren.length - 1) {
          const isChildSubBranch = child.children && child.children.length > 0 && !collapsedNodes.has(child.id);
          total += isChildSubBranch ? BRANCH_GAP : SIBLING_GAP;
        }
      });

      node.subtreeHeight = Math.max(node.height, total);
      return node.subtreeHeight;
    };

    computeSubtreeHeight(root);

    // 3. Layout X and Y coordinates
    const visibleList: ProcessedNode[] = [];

    const positionNode = (node: ProcessedNode, currentX: number, startY: number) => {
      node.x = currentX;
      visibleList.push(node);

      const isCollapsed = collapsedNodes.has(node.id);
      const visibleChildren = (!isCollapsed && node.children) ? node.children : [];

      if (visibleChildren.length === 0) {
        // Leaf or collapsed node: place in center of its allocated vertical slot
        node.y = startY + (node.subtreeHeight - node.height) / 2;
        return;
      }

      // Dynamic horizontal level gap
      const levelGap = node.level === 0 ? 100 : 80;
      const nextX = currentX + node.width + levelGap;

      let currentChildY = startY;
      const childCenters: number[] = [];

      visibleChildren.forEach((child, idx) => {
        positionNode(child, nextX, currentChildY);
        childCenters.push(child.y + child.height / 2);

        currentChildY += child.subtreeHeight;
        if (idx < visibleChildren.length - 1) {
          const isChildSubBranch = child.children && child.children.length > 0 && !collapsedNodes.has(child.id);
          currentChildY += isChildSubBranch ? BRANCH_GAP : SIBLING_GAP;
        }
      });

      // Align parent vertically to the midpoint of its first and last visible child!
      const firstCenter = childCenters[0];
      const lastCenter = childCenters[childCenters.length - 1];
      node.y = (firstCenter + lastCenter) / 2 - node.height / 2;
    };

    positionNode(root, 60, 60);

    // 4. Generate connection curves AFTER all node positions are fully calculated!
    const conns: {
      parent: ProcessedNode;
      child: ProcessedNode;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      branchIndex: number;
    }[] = [];

    for (const node of visibleList) {
      if (collapsedNodes.has(node.id) || !node.children || node.children.length === 0) continue;

      // Start right at the right edge of parent (adjacent to toggle button)
      const toggleOffset = 6;
      const startX = node.x + node.width + (node.hasChildren ? toggleOffset : 0);
      const startY = node.y + node.height / 2; // EXACT VERTICAL CENTER OF PARENT!

      for (const child of node.children) {
        if (!visibleList.includes(child)) continue;

        const endX = child.x;
        const endY = child.y + child.height / 2; // EXACT VERTICAL CENTER OF CHILD!

        conns.push({
          parent: node,
          child,
          startX,
          startY,
          endX,
          endY,
          branchIndex: child.branchIndex,
        });
      }
    }

    // 5. Compute canvas total bounds and normalize coordinates
    let minY = Infinity;
    let maxY = -Infinity;
    let maxX = 800;

    for (const node of visibleList) {
      if (node.y < minY) minY = node.y;
      if (node.y + node.height > maxY) maxY = node.y + node.height;
      if (node.x + node.width > maxX) maxX = node.x + node.width;
    }

    // If any node is placed too close to top (or negative), shift everything down
    if (minY < 50) {
      const shiftY = 50 - minY;
      for (const n of visibleList) n.y += shiftY;
      for (const c of conns) {
        c.startY += shiftY;
        c.endY += shiftY;
      }
      maxY += shiftY;
    }

    return {
      rootNode: root,
      allVisibleNodes: visibleList,
      connections: conns,
      canvasBounds: { width: maxX + 220, height: Math.max(650, maxY + 100) },
    };
  }, [mindMap, collapsedNodes]);

  // Center/Fit view on initial load or reset
  const handleFitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    const padding = 60;
    const scaleX = (clientWidth - padding * 2) / canvasBounds.width;
    const scaleY = (clientHeight - padding * 2) / canvasBounds.height;
    const optimalScale = Math.min(1.2, Math.max(0.45, Math.min(scaleX, scaleY)));

    // Center the graph
    const initialX = Math.max(40, (clientWidth - canvasBounds.width * optimalScale) / 2);
    const initialY = Math.max(40, (clientHeight - canvasBounds.height * optimalScale) / 2);

    setTransform({
      x: Math.round(initialX),
      y: Math.round(initialY),
      scale: parseFloat(optimalScale.toFixed(2)),
    });
  }, [canvasBounds]);

  useEffect(() => {
    handleFitToView();
  }, [handleFitToView]);

  // Pan interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and not on node/button elements
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, [data-interactive="true"]')) return;

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: transform.x,
      startY: transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setTransform((prev) => ({
      ...prev,
      x: dragStartRef.current.startX + dx,
      y: dragStartRef.current.startY + dy,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom on wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(2.4, Math.max(0.35, transform.scale * zoomFactor));

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({
      x: Math.round(newX),
      y: Math.round(newY),
      scale: parseFloat(newScale.toFixed(2)),
    });
  };

  // Zoom in / out controls
  const handleZoom = (direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 1.15 : 0.85;
    const newScale = Math.min(2.4, Math.max(0.35, transform.scale * factor));
    setTransform((prev) => ({
      ...prev,
      scale: parseFloat(newScale.toFixed(2)),
    }));
  };

  // Toggle Collapse
  const handleToggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Expand all / Collapse all
  const handleExpandAll = () => {
    setCollapsedNodes(new Set());
  };

  const handleCollapseAll = () => {
    const allParentIds = new Set<string>();
    const collectParents = (n: ProcessedNode) => {
      if (n.hasChildren && n.level > 0) allParentIds.add(n.id);
      n.children.forEach(collectParents);
    };
    collectParents(rootNode);
    setCollapsedNodes(allParentIds);
  };

  // Search filter
  const matchesSearch = useCallback((title: string) => {
    if (!searchQuery.trim()) return false;
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  // Copy Markdown Outline
  const handleCopyOutline = () => {
    let md = `# ${mindMap.title}\n\n`;
    if (mindMap.description) md += `*${mindMap.description}*\n\n`;

    const writeNode = (node: ProcessedNode, indent: number) => {
      const prefix = '  '.repeat(indent) + '- ';
      md += `${prefix}**${node.title}**${node.summary ? `: ${node.summary}` : ''}\n`;
      node.children.forEach((c) => writeNode(c, indent + 1));
    };

    rootNode.children.forEach((branch) => writeNode(branch, 0));

    navigator.clipboard.writeText(md);
    setCopiedOutline(true);
    setTimeout(() => setCopiedOutline(false), 2000);
  };

  const mindMapExportOptions: ExportOption[] = [
    {
      id: 'svg',
      label: 'Vector Graphic',
      extension: '.svg',
      icon: Download,
      description: 'Scalable vector illustration',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      onClick: () => {
        const svgElement = containerRef.current?.querySelector('svg');
        if (svgElement) exportMindMapSvg(svgElement, mindMap.title || 'MindMap');
      },
    },
    {
      id: 'png',
      label: 'High-Res Image',
      extension: '.png',
      icon: ImageIcon,
      description: 'Retina 2x raster image',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      onClick: async () => {
        const svgElement = containerRef.current?.querySelector('svg');
        if (svgElement) await exportMindMapPng(svgElement, mindMap.title || 'MindMap');
      },
    },
    {
      id: 'md',
      label: 'Outline Markdown',
      extension: '.md',
      icon: FileText,
      description: 'Hierarchical bullet outline',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      onClick: () => {
        exportMindMapOutlineMarkdown(mindMap, mindMap.title || 'MindMap');
      },
    },
    {
      id: 'json',
      label: 'Mind Map JSON',
      extension: '.json',
      icon: FileCode,
      description: 'Raw tree graph structure',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      onClick: () => {
        exportMindMapJson(mindMap, mindMap.title || 'MindMap');
      },
    },
  ];

  return (
    <div 
      className={`relative w-full h-full bg-[#f0f4f9] dark:bg-[#13151b] overflow-hidden select-none flex flex-col font-sans ${
        isFullScreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Search Bar */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts..."
              className="pl-8.5 pr-8 py-1.5 w-52 sm:w-64 rounded-xl bg-white/95 dark:bg-[#1c202a]/90 backdrop-blur-md border border-[#dadce0] dark:border-[#2e3544] text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-md transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-[#1c202a]/90 backdrop-blur-md border border-[#dadce0] dark:border-[#2e3544] text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#3e4758] shadow-md transition-colors cursor-pointer"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-[#1c202a]/90 backdrop-blur-md border border-[#dadce0] dark:border-[#2e3544] text-[11px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#3e4758] shadow-md transition-colors cursor-pointer"
          >
            Collapse All
          </button>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {onRequestCreateMindMap && (
            <button
              onClick={onRequestCreateMindMap}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Map</span>
            </button>
          )}

          <button
            onClick={handleCopyOutline}
            className="px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#1c202a]/90 backdrop-blur-md border border-[#dadce0] dark:border-[#2e3544] text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#3e4758] shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedOutline ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedOutline ? 'Copied' : 'Outline'}</span>
          </button>

          <ExportDropdown items={mindMapExportOptions} buttonLabel="Export" />
        </div>
      </div>

      {/* Main Interactive Pan & Zoom Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full h-full relative overflow-hidden select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage: 'radial-gradient(#252a37 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Transform Container */}
        <div
          className="absolute origin-top-left will-change-transform transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            width: canvasBounds.width,
            height: canvasBounds.height,
          }}
        >
          {/* SVG Connector Splines Layer */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={canvasBounds.width}
            height={canvasBounds.height}
          >
            {connections.map((conn, idx) => {
              const palette = BRANCH_PALETTES[conn.branchIndex % BRANCH_PALETTES.length];
              const dx = (conn.endX - conn.startX) * 0.45;
              const pathData = `M ${conn.startX} ${conn.startY} C ${conn.startX + dx} ${conn.startY}, ${conn.endX - dx} ${conn.endY}, ${conn.endX} ${conn.endY}`;

              return (
                <path
                  key={`curve-${idx}`}
                  d={pathData}
                  fill="none"
                  stroke={palette.curve}
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              );
            })}
          </svg>

          {/* HTML Interactive Nodes Layer */}
          {allVisibleNodes.map((node) => {
            const isRoot = node.level === 0;
            const isBranch = node.level === 1;
            const isLeaf = !node.hasChildren;
            const isCollapsed = collapsedNodes.has(node.id);
            const isSelected = selectedNode?.id === node.id;
            const isMatch = matchesSearch(node.title);

            const palette = isRoot
              ? {
                  curve: '#525b74',
                  nodeBg: '#3e4458',
                  nodeBorder: '#525b74',
                  leafBg: '#3e4458',
                  leafBorder: '#525b74',
                  text: '#ffffff',
                  accent: '#60a5fa',
                  glow: 'rgba(96, 165, 250, 0.2)',
                }
              : BRANCH_PALETTES[node.branchIndex % BRANCH_PALETTES.length];

            const nodeBg = isRoot
              ? '#3e4458'
              : isBranch
              ? palette.nodeBg
              : palette.leafBg;

            const nodeBorder = isSelected
              ? '#60a5fa'
              : isMatch
              ? '#fbbf24'
              : isRoot
              ? '#525b74'
              : isBranch
              ? palette.nodeBorder
              : palette.leafBorder;

            return (
              <div
                key={node.id}
                data-interactive="true"
                onClick={() => setSelectedNode(node)}
                className={`absolute rounded-lg flex items-center justify-between px-3.5 transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-[#13151b] shadow-xl z-20'
                    : isMatch
                    ? 'ring-2 ring-amber-400 shadow-lg z-10'
                    : 'hover:brightness-110 shadow-md'
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                  backgroundColor: nodeBg,
                  border: `1px solid ${nodeBorder}`,
                  boxShadow: isSelected ? `0 0 16px ${palette.glow}` : undefined,
                }}
              >
                {/* Node Title (Short Phrase, up to 2 lines) */}
                <span
                  className="text-xs font-medium tracking-normal text-left flex-1 line-clamp-2 leading-tight select-none pr-1"
                  style={{ color: palette.text }}
                  title={node.title}
                >
                  {node.title}
                </span>

                {/* Right Edge Expand / Collapse Button matching NotebookLM */}
                {node.hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleCollapse(node.id, e)}
                    title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
                    className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-all cursor-pointer z-10 shadow-xs ${
                      isCollapsed
                        ? 'bg-[#202532] hover:bg-blue-600 text-blue-300 hover:text-white border-blue-500/50 hover:border-blue-400'
                        : 'bg-[#1b202c] hover:bg-[#252c3c] text-gray-400 hover:text-white border-[#3b4356]'
                    }`}
                  >
                    <span className="text-[10px] font-bold leading-none select-none">
                      {isCollapsed ? '›' : '‹'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Bottom-Right Zoom Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-2xl bg-white/95 dark:bg-[#1c202a]/90 backdrop-blur-md border border-[#dadce0] dark:border-[#2e3544] shadow-xl">
        <button
          onClick={() => handleZoom('out')}
          title="Zoom out"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282f3d] transition-colors cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleFitToView}
          title="Reset Zoom & Center"
          className="px-2 py-1 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282f3d] transition-colors cursor-pointer"
        >
          {Math.round(transform.scale * 100)}%
        </button>

        <button
          onClick={() => handleZoom('in')}
          title="Zoom in"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282f3d] transition-colors cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-gray-200 dark:bg-[#2e3544] mx-0.5" />

        <button
          onClick={handleFitToView}
          title="Fit to view"
          className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282f3d] transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#282f3d] transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Node Details Drawer / Popover */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 z-30 max-w-sm w-full p-4 rounded-2xl bg-white/95 dark:bg-[#1a1d26]/95 backdrop-blur-xl border border-[#dadce0] dark:border-[#32394a] shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 text-gray-900 dark:text-white">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">
                {selectedNode.level === 0 ? 'Root Concept' : `Level ${selectedNode.level} Node`}
              </div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                {selectedNode.title}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262c3a] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Breadcrumb path */}
          {selectedNode.path.length > 1 && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 truncate">
              {selectedNode.path.join(' → ')}
            </div>
          )}

          {/* Summary / Grounded insight if available */}
          {selectedNode.summary && (
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-[#12141a] p-2.5 rounded-xl border border-gray-200 dark:border-[#242936] mb-3">
              {selectedNode.summary}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-[#2a3040]">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {selectedNode.children.length} sub-concept{selectedNode.children.length !== 1 ? 's' : ''}
            </span>

            <div className="flex items-center gap-1.5">
              {onSaveToNote && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveToNote(
                      selectedNode.title,
                      `# ${selectedNode.title}\n\n${selectedNode.summary || 'Concept from Mind Map'}\n\n*Source: ${selectedNode.path.join(' > ')}*`
                    );
                    setSelectedNode(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 text-[11px] font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FilePlus className="w-3 h-3" />
                  <span>Save Note</span>
                </button>
              )}

              {selectedNode.hasChildren && (
                <button
                  type="button"
                  onClick={(e) => handleToggleCollapse(selectedNode.id, e)}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#242936] hover:bg-gray-200 dark:hover:bg-[#2e3544] border border-gray-200 dark:border-[#3b4356] text-[11px] text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  {collapsedNodes.has(selectedNode.id) ? 'Expand' : 'Collapse'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
