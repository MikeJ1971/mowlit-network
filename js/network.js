"use strict";
const DEFAULT_LAYOUT = 'cose-bilkent';
const ENTITY_TYPE_SELECTOR = 'input[name="entity_type"]';
const HIDE_LABELS_SELECTOR = 'input[name="option"][value="hide_labels"]';
const EDGE_LABEL_VISIBLE_OPACITY = 1;
const EDGE_LABEL_HIDDEN_OPACITY = 0;
const EXPORT_PNG_BUTTON_ID = 'mowlit-export-png-button';
const EXPORT_PNG_FILE_EXTENSION = '.png';
const NON_REMOVABLE_NODE_TYPES = new Set(['ego']);
const GRAPH_CONTAINER_ID = 'mowlit-network';
const LAYOUT_SELECT_ID = 'layout-select';
const ENTITY_FILTER_DEBOUNCE_MS = 100;
const GRAPH_RESIZE_DEBOUNCE_MS = 120;
const MAX_LABEL_WIDTH = 200;
const LABEL_WIDTH_FACTOR = 5.0;
let activeWindowResizeHandler = null;
let activeLayoutChangeHandler = null;
let activeLayoutSelect = null;
let activeEntityTypeChangeHandler = null;
let activeHideLabelsChangeHandler = null;
let activeHideLabelsCheckbox = null;
let activeExportPngClickHandler = null;
let activeExportPngButton = null;
let activeGraphInstance = null;
const NODE_BACKGROUND_COLORS = {
    ego: '#000000',
    person: '#0072B2',
    place: '#009E73',
    manuscript: '#D55E00',
    text: '#E69F00',
    event: '#CC79A7',
    institution: '#F0E442'
};
const NODE_TEXT_COLORS = {
    ego: '#ffffff',
    person: '#000000',
    place: '#000000',
    manuscript: '#000000',
    text: '#000000',
    event: '#000000',
    institution: '#000000'
};
const FALLBACK_NODE_COLOR = '#56B4E9';
const FALLBACK_TEXT_COLOR = '#000000';
const nodeColor = (nodeType) => {
    var _a;
    return (_a = NODE_BACKGROUND_COLORS[nodeType]) !== null && _a !== void 0 ? _a : FALLBACK_NODE_COLOR;
};
const nodeTextColor = (nodeType) => {
    var _a;
    return (_a = NODE_TEXT_COLORS[nodeType]) !== null && _a !== void 0 ? _a : FALLBACK_TEXT_COLOR;
};
const layoutOptions = {
    'cose-bilkent': {
        name: 'cose-bilkent',
        idealEdgeLength: 180,
        nodeRepulsion: 150000,
        edgeElasticity: 1,
        nestingFactor: 0.1,
        gravity: 0.15,
        numIter: 4000,
        animate: 'end',
        tile: true,
        randomize: false,
        nodeDimensionsIncludeLabels: true,
    },
    cose: {
        name: 'cose',
        animate: true,
        idealEdgeLength: 120,
        nodeRepulsion: 6000
    },
    circle: {
        name: 'circle',
        animate: true,
        spacingFactor: 1.2
    },
    concentric: {
        name: 'concentric',
        animate: true,
        spacingFactor: 1.1
    },
    grid: {
        name: 'grid',
        animate: true,
        avoidOverlap: true,
        spacingFactor: 1.3
    },
    fcose: {
        name: 'fcose',
        animate: true,
        idealEdgeLength: 120,
        nodeRepulsion: 8000,
        edgeElasticity: 1,
    },
    breadthFirst: {
        name: 'breadthfirst',
        animate: true,
        spacingFactor: 1.2,
        directed: true,
        padding: 10
    }
};
function resolveLayout(name) {
    if (name && name in layoutOptions) {
        return layoutOptions[name];
    }
    return layoutOptions[DEFAULT_LAYOUT];
}
function getNodeType(source) {
    const rawType = source.data('type');
    return typeof rawType === 'string' ? rawType : '';
}
function getNodeLabelWidth(source) {
    const label = source.data('label');
    const labelLength = typeof label === 'string' ? label.length : 0;
    return Math.min(labelLength * LABEL_WIDTH_FACTOR, MAX_LABEL_WIDTH);
}
function getEdgeWidth(source) {
    var _a;
    const weight = Number((_a = source.data('weight')) !== null && _a !== void 0 ? _a : 1);
    return Math.max(1, weight * 3);
}
function buildStyles() {
    return [
        {
            selector: 'node',
            animate: true,
            style: {
                'label': 'data(label)',
                'background-color': (node) => nodeColor(getNodeType(node)),
                'height': '10',
                'width': (node) => getNodeLabelWidth(node),
                'color': (node) => nodeTextColor(getNodeType(node)),
                'font-size': '12px',
                'padding': '12px',
                'padding-relative-to-label': 'average',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-max-width': '200px',
                'shape': 'round-rectangle',
                'text-wrap': 'ellipsis',
                'border-width': '1px',
            }
        },
        {
            selector: 'edge',
            animate: true,
            style: {
                'width': (edge) => getEdgeWidth(edge),
                'line-color': '#636363',
                'target-arrow-color': '#636363',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 1.1,
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': '10px',
                'color': '#000000',
                'opacity': 0.5
            }
        }
    ];
}
function syncEntityTypeCheckboxes(data) {
    var _a, _b;
    const availableTypes = new Set(((_b = (_a = data.elements) === null || _a === void 0 ? void 0 : _a.nodes) !== null && _b !== void 0 ? _b : [])
        .map((node) => { var _a; return (_a = node.data) === null || _a === void 0 ? void 0 : _a.type; })
        .filter((type) => Boolean(type)));
    document.querySelectorAll(ENTITY_TYPE_SELECTOR).forEach((checkbox) => {
        if (NON_REMOVABLE_NODE_TYPES.has(checkbox.value)) {
            checkbox.disabled = true;
            checkbox.checked = true;
            return;
        }
        const isAvailable = availableTypes.has(checkbox.value);
        checkbox.disabled = !isAvailable;
        checkbox.checked = isAvailable;
    });
}
function getHideLabelsCheckbox() {
    return document.querySelector(HIDE_LABELS_SELECTOR);
}
function isHideLabelsEnabled() {
    var _a, _b;
    return (_b = (_a = getHideLabelsCheckbox()) === null || _a === void 0 ? void 0 : _a.checked) !== null && _b !== void 0 ? _b : false;
}
function applyEdgeLabelVisibility(cy, hideLabels) {
    cy.edges().style('text-opacity', hideLabels ? EDGE_LABEL_HIDDEN_OPACITY : EDGE_LABEL_VISIBLE_OPACITY);
}
function applyLayout(cy, selectedLayout) {
    const layoutConfig = resolveLayout(selectedLayout);
    cy.layout(layoutConfig).run();
}
function attachLayoutSelectorListener(cy, layoutSelect) {
    if (!layoutSelect) {
        return;
    }
    if (activeLayoutSelect && activeLayoutChangeHandler) {
        activeLayoutSelect.removeEventListener('change', activeLayoutChangeHandler);
    }
    const handleLayoutChange = () => {
        applyLayout(cy, layoutSelect.value);
    };
    activeLayoutSelect = layoutSelect;
    activeLayoutChangeHandler = handleLayoutChange;
    layoutSelect.addEventListener('change', handleLayoutChange);
}
function loadGraphData(graphId, onLoaded) {
    const url = `./data/${graphId}.json`;
    jQuery.getJSON(url, onLoaded);
}
function getCheckedEntityTypes() {
    const checkedTypes = new Set();
    document
        .querySelectorAll(`${ENTITY_TYPE_SELECTOR}:checked`)
        .forEach((checkbox) => checkedTypes.add(checkbox.value));
    return checkedTypes;
}
function getComparableId(value) {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }
    return null;
}
function debounce(callback, delayMs) {
    let timerId;
    return () => {
        if (timerId !== undefined) {
            window.clearTimeout(timerId);
        }
        timerId = window.setTimeout(() => {
            callback();
        }, delayMs);
    };
}
function buildFilteredElements(source, enabledTypes) {
    var _a, _b;
    const sourceNodes = (_a = source.nodes) !== null && _a !== void 0 ? _a : [];
    const sourceEdges = (_b = source.edges) !== null && _b !== void 0 ? _b : [];
    const visibleNodes = sourceNodes.filter((node) => {
        var _a;
        const nodeType = (_a = node.data) === null || _a === void 0 ? void 0 : _a.type;
        if (nodeType && NON_REMOVABLE_NODE_TYPES.has(nodeType)) {
            return true;
        }
        if (!nodeType) {
            return true;
        }
        return enabledTypes.has(nodeType);
    });
    const visibleNodeIds = new Set(visibleNodes
        .map((node) => { var _a; return getComparableId((_a = node.data) === null || _a === void 0 ? void 0 : _a.id); })
        .filter((id) => id !== null));
    const visibleEdges = sourceEdges.filter((edge) => {
        var _a, _b;
        const sourceId = getComparableId((_a = edge.data) === null || _a === void 0 ? void 0 : _a.source);
        const targetId = getComparableId((_b = edge.data) === null || _b === void 0 ? void 0 : _b.target);
        if (!sourceId || !targetId) {
            return false;
        }
        return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
    return { nodes: visibleNodes, edges: visibleEdges };
}
function refreshEntityTypeFilter(cy, sourceElements, layoutName) {
    const selectedTypes = getCheckedEntityTypes();
    const filteredElements = buildFilteredElements(sourceElements, selectedTypes);
    cy.elements().remove();
    cy.add(filteredElements);
    applyEdgeLabelVisibility(cy, isHideLabelsEnabled());
    applyLayout(cy, layoutName !== null && layoutName !== void 0 ? layoutName : DEFAULT_LAYOUT);
}
function attachEntityTypeCheckboxListeners(cy, sourceElements, getLayoutName) {
    if (activeEntityTypeChangeHandler) {
        document.querySelectorAll(ENTITY_TYPE_SELECTOR).forEach((checkbox) => {
            checkbox.removeEventListener('change', activeEntityTypeChangeHandler);
        });
    }
    const handleFilterChange = debounce(() => {
        refreshEntityTypeFilter(cy, sourceElements, getLayoutName());
    }, ENTITY_FILTER_DEBOUNCE_MS);
    activeEntityTypeChangeHandler = handleFilterChange;
    document.querySelectorAll(ENTITY_TYPE_SELECTOR).forEach((checkbox) => {
        checkbox.addEventListener('change', handleFilterChange);
    });
}
function attachWindowResizeListener(cy, getLayoutName) {
    if (activeWindowResizeHandler) {
        window.removeEventListener('resize', activeWindowResizeHandler);
    }
    const handleResize = debounce(() => {
        cy.resize();
        applyLayout(cy, getLayoutName());
    }, GRAPH_RESIZE_DEBOUNCE_MS);
    activeWindowResizeHandler = handleResize;
    window.addEventListener('resize', handleResize);
}
function attachHideLabelsListener(cy) {
    const checkbox = getHideLabelsCheckbox();
    if (!checkbox) {
        return;
    }
    if (activeHideLabelsCheckbox && activeHideLabelsChangeHandler) {
        activeHideLabelsCheckbox.removeEventListener('change', activeHideLabelsChangeHandler);
    }
    const handleHideLabelsChange = () => {
        applyEdgeLabelVisibility(cy, checkbox.checked);
    };
    activeHideLabelsCheckbox = checkbox;
    activeHideLabelsChangeHandler = handleHideLabelsChange;
    checkbox.addEventListener('change', handleHideLabelsChange);
    handleHideLabelsChange();
}
function attachExportPngListener(cy, graphId) {
    const exportButton = document.getElementById(EXPORT_PNG_BUTTON_ID);
    if (!exportButton) {
        return;
    }
    if (activeExportPngButton && activeExportPngClickHandler) {
        activeExportPngButton.removeEventListener('click', activeExportPngClickHandler);
    }
    const handleExportPngClick = () => {
        const pngDataUrl = cy.png({
            full: true,
            scale: 2,
            bg: '#ffffff'
        });
        const link = document.createElement('a');
        link.href = pngDataUrl;
        link.download = `${graphId}${EXPORT_PNG_FILE_EXTENSION}`;
        link.click();
    };
    activeExportPngButton = exportButton;
    activeExportPngClickHandler = handleExportPngClick;
    exportButton.addEventListener('click', handleExportPngClick);
}
function createGraph(graphId) {
    const layoutSelect = document.getElementById(LAYOUT_SELECT_ID);
    const initialLayout = resolveLayout(layoutSelect === null || layoutSelect === void 0 ? void 0 : layoutSelect.value);
    loadGraphData(graphId, (data) => {
        var _a, _b, _c, _d;
        syncEntityTypeCheckboxes(data);
        const sourceElements = {
            nodes: [...((_b = (_a = data.elements) === null || _a === void 0 ? void 0 : _a.nodes) !== null && _b !== void 0 ? _b : [])],
            edges: [...((_d = (_c = data.elements) === null || _c === void 0 ? void 0 : _c.edges) !== null && _d !== void 0 ? _d : [])]
        };
        const initialElements = buildFilteredElements(sourceElements, getCheckedEntityTypes());
        if (activeGraphInstance === null || activeGraphInstance === void 0 ? void 0 : activeGraphInstance.destroy) {
            activeGraphInstance.destroy();
        }
        const cy = cytoscape({
            container: document.getElementById(GRAPH_CONTAINER_ID),
            elements: initialElements,
            style: buildStyles(),
            layout: initialLayout
        });
        activeGraphInstance = cy;
        attachLayoutSelectorListener(cy, layoutSelect);
        attachEntityTypeCheckboxListeners(cy, sourceElements, () => { var _a; return (_a = layoutSelect === null || layoutSelect === void 0 ? void 0 : layoutSelect.value) !== null && _a !== void 0 ? _a : DEFAULT_LAYOUT; });
        attachWindowResizeListener(cy, () => { var _a; return (_a = layoutSelect === null || layoutSelect === void 0 ? void 0 : layoutSelect.value) !== null && _a !== void 0 ? _a : DEFAULT_LAYOUT; });
        attachHideLabelsListener(cy);
        attachExportPngListener(cy, graphId);
    });
}
window.create_graph = createGraph;
