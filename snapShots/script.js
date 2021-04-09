self.onInit = function () {
    let data = self.ctx.data
    let $scope = self.ctx.$scope
    let $injector = self.ctx.$scope.$injector
    let assetService = $injector.get(self.ctx.servicesMap.get('assetService'))
    let attributeService = $injector.get(self.ctx.servicesMap.get('attributeService'))
    let deviceService = $injector.get(self.ctx.servicesMap.get('deviceService'))
    let snapshots = []

    data.forEach(key => {
        if (key.dataKey.name == 'snapshots') {
            snapshots.push({
                date: key.datasource.name,
                snapshots: JSON.parse(key.data[0][1])
            })
            $scope.snapshots = snapshots
        }
    })

    $(document).ready(() => {
        $(".layer").click(function (event) {
            let box = event.target.closest('.layers')
            let deviceName = $(this)[0].offsetParent.querySelector('.mat-card-title').innerText
            let id = self.ctx.data[0].datasource.entityId
            let cardTitle = event.currentTarget.querySelector('.mat-card-title').innerText
            let url = ''

            Array.from(box.children).forEach(item => {
                item.classList.remove('active')
            })
            $(this).toggleClass("active")

            // вывести в функцию и присвоить ее результат url
            snapshots.forEach(obj => {
                if (obj.date === deviceName) {
                    obj.snapshots.forEach(item => {
                        if (item.name === cardTitle) {
                            url = item.url
                        }
                    })
                }
            })

            // находим отношения устройства по id
            ctx.entityRelationService.findByTo({id: id, entityType: 'DEVICE'})
                .subscribe(response => {
                    let assetId = response[0].from.id
                    let assetForRequest = {
                        id: assetId,
                        entityType: 'ASSET'
                    }
                    let attributesArray = [{key: 'tiffMaps', value: [url]}]
                    // записываем нужный url в атрибут
                    attributeService.saveEntityAttributes(assetForRequest, 'SERVER_SCOPE', attributesArray)
                        .subscribe(attr => {
                            self.ctx.updateAliases()
                        })
                })
        })
    })

}

self.onDataUpdated = function () {
}

self.onResize = function () {
}

self.onDestroy = function () {
}
