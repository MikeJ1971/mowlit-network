"use strict";
const ENTITY_CHOICE_SELECT_ID = 'entity-choice';
const ENTITY_CHOICE_DEFAULT_GRAPH_ID = '9ad432d4-2d5d-4330-be67-adcf4c90c3a3';
let activeEntityChoiceChangeHandler = null;
let activeEntityChoiceSelect = null;
function getEntityChoiceSelect() {
    return document.getElementById(ENTITY_CHOICE_SELECT_ID);
}
function getSelectedGraphId() {
    var _a;
    const selectedGraphId = (_a = getEntityChoiceSelect()) === null || _a === void 0 ? void 0 : _a.value;
    return selectedGraphId || ENTITY_CHOICE_DEFAULT_GRAPH_ID;
}
function createSelectedGraph() {
    var _a, _b;
    (_b = (_a = window).create_graph) === null || _b === void 0 ? void 0 : _b.call(_a, getSelectedGraphId());
}
function attachEntityChoiceListener() {
    const entityChoiceSelect = getEntityChoiceSelect();
    if (!entityChoiceSelect) {
        return;
    }
    if (activeEntityChoiceSelect && activeEntityChoiceChangeHandler) {
        activeEntityChoiceSelect.removeEventListener('change', activeEntityChoiceChangeHandler);
    }
    const handleEntityChoiceChange = () => {
        createSelectedGraph();
    };
    activeEntityChoiceSelect = entityChoiceSelect;
    activeEntityChoiceChangeHandler = handleEntityChoiceChange;
    entityChoiceSelect.addEventListener('change', handleEntityChoiceChange);
}
window.addEventListener('DOMContentLoaded', () => {
    attachEntityChoiceListener();
    createSelectedGraph();
});
