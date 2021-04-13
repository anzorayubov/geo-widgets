// https://cdn.jsdelivr.net/npm/geotif
// https://unpkg.com/browse/geotiff@1.0.4/dist-browser/geotiff.js
// https://npmcdn.com/geotiff@0.3.6/dist/geotiff.js
// https://raw.githubusercontent.com/Allive/geoportal_tiffs/main/geotiff.js - our repo for 0.3.6

const PORT = '3000'
const log = (text = '', data) => console.log(text, data)
self.onInit = function () {
    const $injector = self.ctx.$scope.$injector;
    const assetService = $injector.get(self.ctx.servicesMap.get('assetService'));
    const attributeService = $injector.get(self.ctx.servicesMap.get('attributeService'));
    const map = L.map("map")
    googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 50,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map)

    self.ctx.$scope.info = []

    // добавление тулбара
    try {
        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawCircleMarker: false,
            cutPolygon: true,
        })
        map.pm.setLang('ru')

        map.pm.setGlobalOptions({
            pinning: true,
            snappable: false,
            showTooltip: true,
            showTooltipOnHover: true
        })

    } catch (e) {
        console.log('TOOLBAR', e)
    }

    function addGeoTiffMaps(url, polygonsCoordinates) {
        // const dataType = url?.indexOf('.asc') != -1 ? 'asc' : 'tiff'
        const dataType = url?.includes('.asc') ? 'asc' : 'tiff'

        switch (dataType) {
            case 'asc': //ToDo remove replace
                fetch(url.replace('localhost', '31.148.204.228'))
                    .then(r => r.text())
                    .then(text => {
                        drawLayer(text, dataType, polygonsCoordinates)
                    })
                break;

            case 'tiff': //ToDo remove replace
                fetch(url.replace('localhost', '31.148.204.228'))
                    .then(r => r.arrayBuffer())
                    .then(async (buffer) => {
                        try {
                            await drawLayer(buffer, dataType, polygonsCoordinates)
                        } catch (e) {
                            // console.log('drawLayer()', e)
                        }
                    })
                break
        }

        async function drawLayer(data, dataType) {
            let maskPolygonCoordinates = [];
            polygonsCoordinates.forEach((element) => {
                if (element.length) {
                    element.forEach(el => {
                        maskPolygonCoordinates.push([el.lng, el.lat])
                    })
                } else {
                    maskPolygonCoordinates.push([element.lng, element.lat])
                }
            })

            const mask = {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [maskPolygonCoordinates]
                }
            }
            let s

            try {
                if (dataType === 'asc')
                    s = L.ScalarField.fromASCIIGrid(data);
                else if (dataType === 'tiff')
                    s = await L.ScalarField.fromGeoTIFF(data)

            } catch (err) {
                //  console.log('error in L.ScalarField.from...()', err)
                return
            }

            const minValue = +s.range[0].toFixed(2)
            const maxValue = +s.range[1].toFixed(2)

            $('.minValue').text(minValue)
            $('.maxValue').text(maxValue)

            s.setSpatialMask(mask)

            layer = L.canvasLayer.scalarField(s, {
                opacity: 0.8
            })

            // не добавлять geotiff фотки на экране списка NDVI
            if (self.ctx.datasources[0].dataKeys.length > 2) {
                layer.addTo(map)
            }

            // Dynamic styles
            const low = document.getElementById('lowColor')
            const high = document.getElementById('highColor')
            const updateGradient = function () {
                let scale = chroma.scale([low.value, high.value]).domain(s.range)
                layer.setColor(scale)
            }

            /* dynamic filtering */
            self.ctx.$scope.sliderChanged = function (e) {
                let h = e.value
                let f = function (v) {
                    return v >= 0 && v <= h
                }
                layer.setFilter(f)
            }

            let isInitialized = false

            self.ctx.$scope.changeMade = function (i, event) {
                if (event.checked) {
                    const colors = ["#fff7ec", "#fc8d59", "#7f0000"]
                    const slider = document.getElementById('slider')

                    if (!isInitialized) {
                        noUiSlider.create(slider, {
                            start: [minValue, maxValue * 0.3, maxValue * 0.6, maxValue],
                            connect: true,
                            range: {'min': minValue, 'max': maxValue}
                        })

                        slider.noUiSlider.on('change.one', function (e) {
                            e.map(num => +num)
                            const scale = chroma.scale('OrRd').classes(e)
                            layer.setColor(scale)
                        })
                        isInitialized = true
                    } else {
                        $('#slider').show(500)
                    }

                    const IUconnects = document.getElementsByClassName("noUi-connects")
                    IUconnects[0].childNodes.forEach((item, index) => {
                        item.style.backgroundColor = colors[index]
                    })

                    const scale = chroma.scale('OrRd').classes([minValue, maxValue * 0.3, maxValue * 0.6, maxValue])
                    layer.setColor(scale)

                } else if (!event.checked) {
                    updateGradient()
                    $('#slider').hide(500)
                }
            }

            // Todo
            // отключить автоматичекое перерисовывание!! в нужный момент вызывать layer.needRedraw()

            low.addEventListener('input', updateGradient)
            high.addEventListener('input', updateGradient)

            const scale = chroma.scale(["#000000", "#FFFFFF"]).domain(s.range)
            layer.setColor(scale)

            layer.on("click", function (e) {
                if (e.value !== null) {
                    const v = e.value//.toFixed(3)
                    const html = `<span class="popupText">${v}</span>`

                    const popup = L.popup()
                        .setLatLng(e.latlng)
                        .setContent(html)
                        .openOn(map)
                }
            })

            layer.on("mousemove", function (e) {
                if (e.value !== null) {
                    const v = e.value.toFixed(3)
                    const html = `<span class="popupText">${v}</span>`
                    const popup = L.popup()
                        .setLatLng(e.latlng)
                        .setContent(html)
                        .openOn(map)
                }
            })

            map.fitBounds(layer.getBounds()) // <- куда наводить карту

        }
    }

    function onRemovePolygon(polygon, polygonName) {
        polygon = typeof polygon.on == 'function' ? polygon : polygon.layer
        polygon.on('pm:remove', e => {
            polygonName = typeof e.target._popup != 'undefined' ? e.target._popup._content : polygonName

            assetService.findByName(polygonName).subscribe(asset => {
                assetService.deleteAsset(asset.id.id).subscribe(() => {
                        setTimeout(() => {
                            try { // имитим событие для обновления списка полигонов
                                exports.Emitter.Emitter.emit('updatePolygonsList', asset)
                            } catch (e) {
                            }
                        }, 1000);
                    }
                )
            })
        })
    }

    let accessCut = true

    function onUpdatePolygon(polygon, polygonName) {
        polygon = typeof polygon.on == 'function' ? polygon : polygon.layer

        function updateAsset(e) {
            if (!accessCut)
                return

            polygonName = e.target._popup ? e.target._popup._content : polygonName || e.target._tempPopupCopy._content

            let coords = e.target.getLatLngs()[0]

            // если вырезаем облатсь в полигоне
            if (e.type === 'pm:cut') {
                accessCut = false
                setTimeout(() => {
                    accessCut = true
                }, 2000)
                coords = e.layer._latlngs
            }

            // работа с активом
            let id = self.ctx.data[0].datasource.entityId
            let attributesArray = [{key: 'polygonsCoordinates', value: coords}]

            assetService.findByName(polygonName).subscribe(asset => {
                let assetForRequest = {
                    id: asset.id.id,
                    entityType: asset.id.entityType
                }

                attributeService.saveEntityAttributes(assetForRequest, 'SERVER_SCOPE', attributesArray)
                    .subscribe(attr => {
                        if (e.type === 'pm:update') {
                            self.ctx.updateAliases()
                        }
                    })
            })
        }

        polygon.on('pm:update', e => {
            updateAsset(e)
        })
        polygon.on('pm:edit', e => {
            updateAsset(e)
        })
        polygon.on('pm:cut', e => {
            updateAsset(e)
        })

    }

    function createPolygons(coordinates, popupText) {
        const options = {
            fillOpacity: 0,
            tooltips: true,
            showTooltipOnHover: true
        }
        const polygon = L.polygon(coordinates, options).addTo(map)
        polygon.bindPopup(popupText)
        onUpdatePolygon(polygon)
        onRemovePolygon(polygon)
    }

    function getData() {
        const coordsArray = map.pm.getGeomanDrawLayers()
        return JSON.stringify(coordsArray[0]._latlngs[0])
    }

    map.on('pm:create', polygon => {
        let asset = {
            name: `Новый полигон-${Date.now()}`,
            type: 'geoData'
        }
        onUpdatePolygon(polygon, asset.name)
        onRemovePolygon(polygon, asset.name)

        let attributesArray = [{
            key: 'polygonsCoordinates',
            value: getData()
        }]
        // сохраняет созданный полигон как актив
        assetService.saveAsset(asset).subscribe((as) => {
            attributeService.saveEntityAttributes(as.id, 'SERVER_SCOPE', attributesArray)
                .subscribe(() => {
                    //setTimeout(() => {
                    $.ajax({
                        url: `http://${window.location.hostname}:${PORT}/polygons/add`,
                        method: "POST",
                        data: {
                            id: as.id.id,
                            name: asset.name
                        }
                    })
                    /*fetch(`http://${window.location.hostname}:${PORT}/polygons/add`, {
                         method: 'POST',
                         body: {id: as.id}
                     })
                 }, 1000)*/
                })
        })

        setTimeout(() => {
            // имитим событие для списка полигонов
            try {
                exports.Emitter.Emitter.emit('updatePolygonsList', asset)
            } catch (e) {
            }
        }, 1000)
    })

    map.on("pm:cut", function (e) {

    });

    let polygonsCoordinates;

    getTBkeys()

    function getTBkeys() {
        self.ctx.data.forEach(data => {
            let keyName = data.dataKey.name
            let polygonName = data.datasource.name

            if (keyName === "polygonsCoordinates") {
                polygonsCoordinates = JSON.parse(data.data[0][1])
                createPolygons(JSON.parse(data.data[0][1]), polygonName)
            }

            if (keyName === "tiffMaps" && data.data[0][1] !== '') {
                JSON.parse(data.data[0][1]).forEach(url => {
                    addGeoTiffMaps(url, polygonsCoordinates)
                })
            }
        })
    }

    setTimeout(function () {
        // сделать не кликабельным
        // $('.leaflet-interactive').css({'pointer-events': 'none'})

        self.ctx.data.forEach(item => {
            if (item.dataKey.name === 'additionalInfo') {
                try {
                    const data = JSON.parse(item.data[0][1])
                    self.ctx.$scope.info = data
                    self.ctx.detectChanges()
                } catch (e) {
                }
            }
        })
        // тут логика при редактировании инпутов
        $('.infoTable input').change((event) => {
            const cardIndex = event.target.closest('mat-card').dataset.index
            const inputValue = event.target.value
            const inputType = event.target.dataset.type

            // работа с активом
            let id = self.ctx.data[0].datasource.entityId

            ctx.attributeService.getEntityAttributes({id: id, entityType: 'ASSET'}, 'SERVER_SCOPE', ['additionalInfo'])
                .subscribe(responce => {
                    let dataArray = []


                    if (responce?.length < 1 || responce[0].value == 'null') {
                        const IUconnects = document.getElementsByClassName("noUi-connects")
                        IUconnects[0].childNodes.forEach((item, index) => {
                            dataArray.push({
                                cardIndex: index,
                                value: {},
                                color: self.ctx.$scope.info[index].color,
                            })
                            dataArray[cardIndex].value[inputType] = inputValue
                        })

                        attributeService.saveEntityAttributes({id: id, entityType: 'ASSET'}, 'SERVER_SCOPE',
                            [{key: 'additionalInfo', value: dataArray}]).subscribe((answer) => {
                        })
                    } else {
                        dataArray = responce[0].value
                        dataArray[cardIndex].value[inputType] = inputValue

                        attributeService.saveEntityAttributes({id: id, entityType: 'ASSET'}, 'SERVER_SCOPE',
                            [{key: 'additionalInfo', value: dataArray}]).subscribe(() => {
                        })
                    }
                })
        })
    }, 1000)
}


self.onDataUpdated = function () {
}

self.onResize = function () {
}

self.onDestroy = function () {
}

// доки по работе с плагинами
// https://github.com/stuartmatthews/leaflet-geotiff
// https://github.com/IHCantabria/Leaflet.CanvasLayer.Field
// https://github.com/geoman-io/leaflet-geoman

// библотеки
