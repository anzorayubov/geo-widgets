self.onInit = function () {

    try {
        exports.Emitter.Emitter.subscribe('updatePolygonsList', (data) => {
            self.ctx.$scope.entitiesTableWidget.updateData()
        })
    } catch (e) {
    }
}

self.onDataUpdated = function () {
    self.ctx.$scope.entitiesTableWidget.onDataUpdated()

    const polygonsList = $('tbody mat-row mat-cell:first-child')
    let selectedField = sessionStorage.getItem('selectedField')

    if (selectedField) {
        try {
            selectedField = JSON.parse(selectedField).selectedField
            Array.from(polygonsList).forEach(row => {
                if (row.innerText === selectedField) {
                    console.log([row])
                    const clickEvent = new Event('click')
                    // row.parentNode.dispatchEvent(clickEvent)
                }
            })
        } catch (e) {
            console.log(e)
        }
    }

    polygonsList.click(event => {
        const selectedField = event.target.innerHTML
        sessionStorage.setItem('selectedField', JSON.stringify({selectedField}))
    })

}

self.typeParameters = function () {
    return {
        maxDatasources: 1,
        hasDataPageLink: true,
        warnOnPageDataOverflow: false,
        dataKeysOptional: true
    };
}

self.actionSources = function () {
    return {
        'actionCellButton': {
            name: 'widget-action.action-cell-button',
            multiple: true
        },
        'rowClick': {
            name: 'widget-action.row-click',
            multiple: false
        },
        'rowDoubleClick': {
            name: 'widget-action.row-double-click',
            multiple: false
        }
    };
}

self.onDestroy = function () {
}

Emitter = function () {
}
(function () {
    this.Emitter = {
        listeners: {},
        emit: (event, ...arg) => {
            if (!Array.isArray(this.Emitter.listeners[event])) {
                return false
            }
            this.Emitter.listeners[event].forEach(listener => {
                listener(...arg)
            })
            return true
        },
        subscribe: (event, fn) => {
            this.Emitter.listeners[event] = this.Emitter.listeners[event] || []
            this.Emitter.listeners[event].push(fn)
            return () => {
                this.Emitter.listeners[event] = this.Emitter.listeners[event].filter(listener => listener !== fn)
            }
        }
    }
}).call(Emitter);
exports = {}
exports.Emitter = Emitter;
