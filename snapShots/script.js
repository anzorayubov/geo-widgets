self.onInit = function () {
    let data = self.ctx.data
    let $scope = self.ctx.$scope
    let $injector = self.ctx.$scope.$injector
    let attributeService = $injector.get(self.ctx.servicesMap.get('attributeService'))
    let snapshots = []
    $scope.baseUrl = window.location.hostname

    // вынести это в  функцию // getSnapShots
    data.forEach(key => {
        if (key.dataKey.name === 'snapshots') {
            snapshots.push({
                date: key.datasource.name,
                snapshots: JSON.parse(key.data[0][1])
            })

            $scope.snapshots = sortByDate(snapshots)
        }
    })

    $(document).ready(() => {
        $(".layer").click(function (event) {
            const deviceName = $(this)[0].offsetParent.querySelector('.mat-card-title').innerText
            const id = self.ctx.data[0].datasource.entityId
            const cardTitle = event.currentTarget.querySelector('.mat-card-title').innerText
            let url = ''

            // вынести это в  функцию // getUrl
            snapshots.forEach(obj => {
                if (obj.date === deviceName) {
                    obj.snapshots.forEach(item => {
                        if (item.name === cardTitle)
                            url = item.url
                    })
                }
            })

            // вынести это в  функцию
            // save to attribute
            ctx.entityRelationService.findByTo({id: id, entityType: 'DEVICE'})
                .subscribe(response => {
                    const assetId = response[0].from.id
                    const attribute = [{key: 'tiffMaps', value: [url]}]
                    attributeService.saveEntityAttributes({
                        id: assetId, entityType: 'ASSET'
                    }, 'SERVER_SCOPE', attribute)
                        .subscribe(attr => {

                            // надо бы обновлять карту без обновления всех виджетов
                            // через emitter
                            exports.Emitter.Emitter.emit('updateMap', {url})
                            self.ctx.updateAliases()
                        })
                })
        })
    })

    // mark Active Card

    const id = self.ctx.data[0].datasource.entityFilter?.rootEntity.id

    attributeService.getEntityAttributes({id: id, entityType: 'ASSET'}, 'SERVER_SCOPE', ['tiffMaps'])
        .subscribe(responce => {
            const mapUrl = responce[0].value[0]
            snapshots.forEach(obj => {
                obj.snapshots.forEach(item => {
                    if (item.url === mapUrl) {
                        item.active = true
                        ctx.detectChanges()
                    }
                })
            })
        })
}

function sortByDate(arr) {
    arr.sort((a, b) => {
        if (a.snapshots[0].ts > b.snapshots[0].ts) {
            return -1
        }
        if (a.snapshots[0].ts < b.snapshots[0].ts) {
            return 1
        }
        return 0
    })
    return arr
}

self.onDataUpdated = function () {
}

self.onResize = function () {
}

self.onDestroy = function () {
}

Emitter = function () {
};
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
