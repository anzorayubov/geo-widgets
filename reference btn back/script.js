self.onInit = function () {
    $scope = self.ctx.$scope;
    $scope.ctx = self.ctx;
    root = $scope.$root;

    $scope.onButtonClick = function ($event, entity, actionDescriptor) {
        if ($event) {
            $event.stopPropagation()
        }

        var entityId;
        var entityName;
        if (entity) {
            entityId = entity.id;
            entityName = entity.entityName;
        }
        self.ctx.actionsApi.handleWidgetAction(null, actionDescriptor, entityId, null)

        sessionStorage.removeItem('selectedField')
    }

    function hashCode(str) {
        var hash = 0;
        var i, char;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
}

self.actionSources = function() {
    return {
        'elementClick': {
            name: 'widget-action.element-click',
            multiple: true
        }
    };
}
