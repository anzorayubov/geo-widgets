const PORT = '1880'

self.onInit = function () {
    const $injector = self.ctx.$scope.$injector;
    const assetService = $injector.get(self.ctx.servicesMap.get('assetService'));
    const attributeService = $injector.get(self.ctx.servicesMap.get('attributeService'));

    const map = L.map("map")
    googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 50,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map)

    // добавление тулбара
    try {
        map.pm.addControls({
            position: 'topleft',
            drawCircle: false,
            drawCircleMarker: false,
            cutPolygon: true,
        })
    } catch (e) {
    }

    let dataPromise

    function addGeoTiffMaps(url, polygonsCoordinates) {
        const dataType = url.indexOf('.asc') != -1 ? 'asc' : 'tiff'

        switch (dataType) {
            case 'asc':
                fetch(url)
                    .then(r => r.text())
                    .then(text => {
                        drawLayer(text, dataType, polygonsCoordinates)
                    })
                break;

            case 'tiff':
                fetch(url)
                    .then(r => r.arrayBuffer())
                    .then(buffer => {
                        drawLayer(buffer, dataType, polygonsCoordinates)
                    })
                break
        }

        function drawLayer(data, dataType) {
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

            if (dataType == 'asc')
                s = L.ScalarField.fromASCIIGrid(data);
            else if (dataType == 'tiff')
                s = L.ScalarField.fromGeoTIFF(data)

            let arrayValue = s.grid
                .flat()
                .filter(val => val != null)
                .map(val => parseFloat(val.toFixed(4))) // кол значений после запятой
                .filter(val => val > 0)
                .sort()

            const minValue = Math.min.apply(null, arrayValue)
            const maxValue = Math.max.apply(null, arrayValue)

            $('.minValue').text(minValue)
            $('.maxValue').text(maxValue)

            s.setSpatialMask(mask)
            layer = L.canvasLayer.scalarField(s, {
                opacity: 0.8,
                inFilter: (v) => v > 0,
            }).addTo(map)

            /* dynamic filtering */
            self.ctx.$scope.sliderChanged = function (e) {
                let h = e.value
                let f = function (v) {
                    return v >= 0 && v <= h
                }
                layer.setFilter(f)
            }

            // Dynamic styles
            const low = document.getElementById('lowColor')
            const high = document.getElementById('highColor')

            let updateGradient = function () {
                console.log([low.value, high.value])
                let scale = chroma.scale([low.value, high.value]).domain(s.range)
                layer.setColor(scale)
            }

            low.addEventListener('input', updateGradient)
            high.addEventListener('input', updateGradient)

            setTimeout(() => {
                const colors = []
                colors.push(layer.options.color.colors()[0])
                colors.push(layer.options.color.colors()[4])
                colors.push(layer.options.color.colors()[8])

                // SLIDER
                const slider = document.getElementById('slider');
                noUiSlider.create(slider, {
                    start: [minValue, maxValue * 0.3, maxValue * 0.6, maxValue],
                    connect: true,
                    range: {
                        'min': minValue,
                        'max': maxValue
                    }
                });
                slider.noUiSlider.on('change.one', function (e) {
                    e.map(num => parseInt(num))
                    const scale = chroma.scale('OrRd').classes(e)
                    layer.setColor(scale)
                })

                const IUconnects = document.getElementsByClassName("noUi-connects");

                IUconnects[0].childNodes.forEach((item, index) => {
                    item.style.backgroundColor = colors[index]
                })
            }, 500)

            let scale = chroma.scale('OrRd').classes(3)// <- массив с отрезками значений
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

            layer.addTo(map)
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
            if (e.type == 'pm:cut') {
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
                        if (e.type == 'pm:update') {
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
        // if (!Array.isArray(coordinates[0])) {
        let options = {
            fillOpacity: 0,
        }
        let polygon = L.polygon(coordinates, options).addTo(map)
        polygon.bindPopup(popupText)

        onUpdatePolygon(polygon)
        onRemovePolygon(polygon)

        // } else {
        //     let polygon = L.polygon(coordinates).addTo(map)
        //     polygon.bindPopup(popupText)
        // }
    }

    function getData() {
        let coordsArray = map.pm.getGeomanDrawLayers()
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
                    fetch(`http://${window.location.hostname}:${PORT}/polygon/add`, {
                        method: 'POST',
                        body: {id: as.id}
                    })
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
        $('.leaflet-interactive').css({'pointer-events': 'none'})
    }, 1000);
    // доки по работе с плагинами
    // https://github.com/stuartmatthews/leaflet-geotiff
    // https://github.com/IHCantabria/Leaflet.CanvasLayer.Field
    // https://github.com/geoman-io/leaflet-geoman
}


self.onDataUpdated = function () {
}

self.onResize = function () {
}

self.onDestroy = function () {
}

// библотека из за которой была ошибка в консоли
// https://unpkg.com/leaflet-canvaslayer-field/dist/leaflet.canvaslayer.field.js
