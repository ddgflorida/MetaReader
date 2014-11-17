/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */



function MetaReader() {

    var mr = {};
    var DEFAULT_PRECISION = 2;
    mr.columns = {};
    mr.statistics = {};
    mr.filename = '';
    mr.loadFile = function(csvFilePath)
    {
        mr.filename = csvFilePath;
        var csv = loadFromFile(csvFilePath);
//        console.log(csv);
        mr.columns = csvToColumns(csv);
        mr.statistics = process_columns(mr.columns);
    };

    mr.sort = {ascending: function(a, b) {
            var n1 = Number(a), n2 = Number(b);
//            console.log(a + '\t' + n1 + '\t' + b + '\t' + n2)
            if (checkNull(n1) || checkNull(n2))
            {
//                console.log(a + '\t' + n1 + '\t' + b + '\t' + n2)
                return d3.ascending(a, b);
            } else
                return n1 - n2;
        }, descending: function(a, b) {
            var n1 = Number(a), n2 = Number(b);
//            console.log(a + '\t' + n1 + '\t' + b + '\t' + n2)
            if (checkNull(n1) || checkNull(n2))
                return d3.descending(a, b);
            else
                return n2 - n1;
        }};
    mr.reload = function(previous)
    {
        mr.columns = previous.columns;
        mr.statistics = previous.statistics;
    };

    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\\s])/g, "-");
    }
    var ObjectList = function(data, title, metrics) {
        var self = {};
        self.title = title;
        self.columnName = title;
        self.metrics = metrics;
        self.id = escapeRegExp(self.columnName);
        // console.log(self.id);
        self.notes = '';
        self.description = '';
        self.questions = [];
        self.suggestions = [];
        self.data = _.clone(data);
//        self.rawData = _.clone(data);
        data = cleanData(data);
        self.uniqueValues = d3.set(self.data).values();
//    console.log(self.uniqueValues);
        self.countUnique = self.uniqueValues.length;

        self.count = data.length;



        self.prepData = function() {
//            self.sortedData = _.clone(self.data).sort(d3.ascending);
            var sortedData = _.clone(self.data).sort(d3.ascending);

            self.cleanData = _.filter(sortedData, function(d) {
                return !checkNull(d);
            });
            self.median = d3.median(sortedData);
            self.count = data.length;
            self.frequencyDistribution = getFreqDist(self.cleanData);
//            self.spectrum = getSequence(self.data);
        };
        self.prepData();
        return self;
    };
    var BIN_LIMIT = 10;
    var NumberList = function(data, title, metrics, precision) {
        precision = (_.isUndefined(precision)) ? DEFAULT_PRECISION : precision;
//        console.log('precision = ' + precision)
        var self = ObjectList(data, title, metrics);
        _.each(self.data, function(d, i) {
            var n = (d === '') ? null : Number(d);
            self.data[i] = (checkNull(n, true)) ? null : round(n, precision);
        });

        self.prepData();
        self.type = 'integer';
        self.precision = precision;
        var statPrecision = precision + 2;
        var stats = getStats(self.cleanData);
        self.sum = round(stats.sum, precision);
        self.mean = round(stats.mean, statPrecision);
        self.variance = round(stats.variance, statPrecision);
        self.stddev = round(stats.deviation, statPrecision);
        self.median = round(self.median, statPrecision);
//        self.median = d3.median(self.sortedData);
        self.min = round(Number(d3.min(self.data)), precision);
        self.max = round(Number(d3.max(self.data)), precision);
        self.range = round(self.max - self.min, precision);
        self.quantiles = [];
        for (var i = 0, j = 1; i <= j; i += .1)
            self.quantiles.push(round(d3.quantile(self.cleanData, i), statPrecision));
        self.quartiles = [];
        for (var i = 0, j = 1; i <= j; i += .25)
            self.quartiles.push(round(d3.quantile(self.cleanData, i), statPrecision));
        self.interQuartileRange = self.quartiles[3] - self.quartiles[1];
        self.bins = (self.countUnique > BIN_LIMIT) ? BIN_LIMIT : self.countUnique;
        self.bins += 1;
        self.frequencyDistribution = getFreqDist(self.cleanData);
        self.frequencyDistributionBins = getFreqDistBins(self.cleanData, self.bins, self.min, self.range);
        self.zeros = d3.sum(self.cleanData, function(item) {
            return (item === 0) ? 1 : 0;
        });
        self.invalidValues = self.data.length - self.cleanData.length;
        self.frequencyDistributionSorted = _.sortBy(self.frequencyDistribution, function(d) {
            return d.values;
        });
        self.frequencyDistributionSorted.reverse();
        self.mode = getMode(self.frequencyDistributionSorted);

        return self;
    };
    var IntList = function(data, title, metrics) {
        var self = NumberList(data, title, metrics, 0);
        self.type = 'integer';
        return self;
    };
    var FloatList = function(data, title, metrics, precision) {
        var self = NumberList(data, title, metrics, precision);
        self.type = 'float';

        return self;
    };
    var StringList = function(data, title, metrics) {
        var self = {};
        var self = ObjectList(data, title, metrics);
        self.type = 'string';
        self.tokens = $.map(self.data, function(d) {
            return (!checkNull(d)) ? d.split(' ') : '';
        });
        self.word_count = d3.sum(self.tokens, function(d) {
            return (!checkNull(d)) ? d.length : 0;
        });

        self.average_word_count = self.word_count / self.count;
        self.average_word_length = d3.sum(self.data, function(d) {
            return (!checkNull(d)) ? d.replace(' ', '').length : 0;
        });

        return self;
    };
    var DateList = function(data, title, metrics, userFormat) {
        var self = ObjectList(data, title, metrics);

        self.type = 'date';
        asDate = _.each(self.cleanData, function(v, i, a) {
            a[i] = moment(v);
        });
//        self.format = moment.parseFormat()
        self.prepData();
        self.asDate = _.sortBy(asDate);
        // formatted for Rickshaw js input
        self.timeSeries = _.each(getFreqDist(self.asDate), function(v, i, a) {
            a[i] = {'x': moment(+v.key).unix(), 'y': v.values};
        });
        self.max = _.last(self.asDate);
//        for(var x in self.max)
//            console.log(self.max._i);
        self.format = moment.parseFormat(self.max._i);
        self.min = _.first(self.asDate);
        self.range = moment.duration(self.max - self.min);
        self.invalidValues = self.data.length - self.cleanData.length;
        // NOTE: call humanize() method to get self.range in plain English

        // to determine intervals:
        // check the range,
        // and also make sure the diffs aren't all exactly the next largest interval
        self.intervals = {
            'year': self.max.diff(self.min, 'years') > 0,
            'month': self.max.diff(self.min, 'months') > 0 && _.some(self.asDate,
                    function(v, i, a) {
                        if (a[i + 1] != undefined) {
                            return v.diff(a[i + 1], 'years', true) != v.diff(a[i + 1], 'years');
                        } else {
                            return false;
                        }
                    }),
            'day': self.max.diff(self.min, 'day') > 0 && _.some(self.asDate,
                    function(v, i, a) {
                        if (a[i + 1] != undefined) {
                            return v.diff(a[i + 1], 'months', true) != v.diff(a[i + 1], 'months');
                        } else {
                            return false;
                        }
                    }),
            'hour': self.max.diff(self.min, 'hours') > 0 && _.some(self.asDate,
                    function(v, i, a) {
                        if (a[i + 1] != undefined) {
                            return v.diff(a[i + 1], 'days', true) != v.diff(a[i + 1], 'days');
                        } else {
                            return false;
                        }
                    }),
            'minute': self.max.diff(self.min, 'minutes') > 0 && _.some(self.asDate,
                    function(v, i, a) {
                        if (a[i + 1] != undefined) {
                            return v.diff(a[i + 1], 'hours', true) != v.diff(a[i + 1], 'hours');
                        } else {
                            return false;
                        }
                    }),
            'second': self.max.diff(self.min, 'seconds') > 0 && _.some(self.asDate,
                    function(v, i, a) {
                        if (a[i + 1] != undefined) {
                            return v.diff(a[i + 1], 'minutes', true) != v.diff(a[i + 1], 'minutes');
                        } else {
                            return false;
                        }
                    })
        };
        return self;
    };

    var DATA_TYPES = {'string': StringList, 'integer': IntList, 'float': FloatList, date: DateList};


    function detectDataType(items)
    {
//        var sample_limit = items;
        var new_items = _.filter(items, function(item, index) {
            return !checkNull(item);
        });
        var sample_limit = new_items.length;
        var sample = _.sample(new_items, sample_limit);
        var counts = {integer: 0, float: 0, date: 0, number: 0, string: 0};
        _.each(new_items, function(item)
        {
            var chars = _.clone(item).toLowerCase().match(/[a-z$^{[(|)*+?\\]/i);
            if (chars !== null)
            {
//                console.log(chars);
                counts.string += 1;
            }
            var n = Number(item);
            if (!_.isNaN(n) && chars === null)
            {
                counts.number += 1;
                if (item.indexOf('.') > -1)
                {
                    var f = parseFloat(item);
                    counts.float += 1;
                } else {
                    var integer = parseInt(item);
                    counts.integer += 1;
                }
            }
            if (item.length > 6)
            {
                counts['date'] += (checkDate(item)) ? 1 : 0;
            }
            /*else
             {
             console.log(n);
             var d = new Date(Date.parse(item));
             counts['date'] += (!_.isDate(d)) ? 0 : 1;
             }*/
        });

        var metrics = _.map(counts, function(value, key) {
            return {name: key, value: value};
        });
        var max = _.max(metrics, function(metric) {
            return metric.value;
        });
//        console.log(metrics);
//        console.log(max);
        var result = ['string', counts];
        if (max.value > new_items.length / 2)
        {
            if ((max.name === 'number' || max.name === 'integer' || max.name === 'float') && counts.string === 0)
            {
                if (counts.float > 0)
                    result[0] = 'float';
                else
                    result[0] = 'integer';
            }
            else if (max.name === 'date')
                result[0] = max.name;

        }
//        console.log(result)
        return result;
    }
    function checkDate(v)
    {
        // using moment.js library for date handling
        var d = moment(v);
        return d.isValid();
    }
    function getFreqDist(data, precision)
    {
        precision = (precision) ? precision : DEFAULT_PRECISION;

        return d3.nest()
                .key(function(d) {
                    if (isNaN(Number(d)))
                        return d;
                    else
                        return round(Number(d), precision);
                }).sortKeys(mr.sort.ascending)
                .rollup(function(leaves) {
                    return leaves.length;
                })
                .entries(data);
    }
    function getFreqDistBins(sortedData, bins, min, range, precision)
    {
        precision = (precision) ? precision : DEFAULT_PRECISION;

        min = (min) ? min : Number(d3.min(sortedData));

        range = (range) ? range : Number(d3.max(sortedData)) - min;
        var binSize = range / bins;
        return d3.nest()
                .key(function(d) {
                    var key = parseInt((d - min) / binSize),
                            start = (min + key * binSize),
                            end = (min + (key + 1) * binSize);

                    return round(start, precision);
                }).sortKeys(mr.sort.ascending)
                .rollup(function(leaves) {
                    return leaves.length;
                })
                .entries(sortedData);
    }

    function getStats(a)
    {
        var r = {sum: 0, count: 0, mean: 0, variance: 0, deviation: 0};
        r.count = a.length;
        r.sum = d3.sum(a);
        r.mean = r.sum / r.count;
        r.variance = d3.sum(a, function(d) {
            return Math.pow(d - r.mean, 2);
        }) / r.count;

        r.deviation = Math.sqrt(r.variance);
        return r;
    }

    function getMode(sortedFD)
    {
        var mode = [];
        var start = 0;
        // debugger;
        if (sortedFD[start] != undefined) {
            while (checkNull(sortedFD[start].key))
            {
                start++;
            }
            for (var i = start, j = sortedFD.length; i < j
                    && sortedFD[i].values === sortedFD[0].values;
                    i++)
            {
                //        console.log(sortedFD[i])
                if (!checkNull(sortedFD[i].key))
                    mode.push({key: sortedFD[i].key, frequency: sortedFD[i].values});
            }
        }
        return mode;

    }




    function loadFromFile(filePath)
    {
        // console.log(filePath);
        if (filePath.slice(-3) === 'csv' || filePath.slice(-3) === 'txt')
            return loadCSVFile(filePath);
        else if (filePath.slice(-3) === 'xls')
        {
            return loadExcelFile(filePath, 'xls');
        }
        else if (filePath.slice(-4) === 'xlsx')
        {
            return loadExcelFile(filePath, 'xlsx');
        }
    }
    function loadCSVFile(csvFilePath)
    {
        var jqxhr = $.ajax({
            url: csvFilePath,
            async: false,
            dataType: "text",
            complete: function() {
                // call a function on complete
            }
        });
        var csvd = jqxhr.responseText;
        var data = $.csv.toObjects(csvd);
//        console.log(data);
        return data;
    }
    /*console.log('load from excel');
     var url = "test_files/formula_stress_test_ajax.xlsx";
     var oReq = new XMLHttpRequest();
     oReq.open("GET", url, true);
     oReq.responseType = "arraybuffer";
     oReq.async = false;
     
     oReq.onload = function(e) {
     console.log('runnng excel')
     var arraybuffer = oReq.response;
     
     
     var data = new Uint8Array(arraybuffer);
     var arr = new Array();
     for (var i = 0; i != data.length; ++i)
     arr[i] = String.fromCharCode(data[i]);
     var bstr = arr.join("");
     
     var workbook
     
     if (version === 'xls')
     workbook = XLS.read(bstr, {type: "binary"});
     else
     workbook = XLSX.read(bstr, {type: "binary"});
     console.log(workbook);
     return workbook;
     };
     var workbook = oReq.send();*/


    /*
     * @param {type} excelFilePath
     * @param {type} version
     * @returns {unresolved}
     *
     */
    function loadExcelFile(excelFilePath, version)
    {
        // console.log('load from excel');
        var oReq = new XMLHttpRequest();
//        oReq.responseType = "arraybuffer";
        oReq.open("GET", excelFilePath, false);


        oReq.send(null);
//        console.log(oReq.responseText)
        var resp = oReq.response;
        // console.log(typeof (resp))
        // console.log('running excel')
        var arraybuffer = s2ab(resp);
        // console.log(arraybuffer)
        // console.log(typeof (arraybuffer))

        var data = new Uint8Array(arraybuffer[0]);
        // console.log(data.length);
        var arr = new Array();
        for (var i = 0; i != data.length; ++i)
            arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");



//        var arr = new Array();
//        var bstr = ab2str(data);
        var workbook;

        if (version === 'xls')
            workbook = XLS.read(bstr, {type: "binary"});
        else
            workbook = XLSX.read(bstr, {type: "binary"});
        // console.log(workbook);
        return workbook;

        /*
         if (version === 'xls')
         workbook = XLS.read(bstr, {type: "binary"});
         else
         workbook = XLSX.read(bstr, {type: "binary"});*/
        /* DO SOMETHING WITH workbook HERE */
//        console.log(workbook);
//        return workbook;
    }

    function ab2str(data) {
        var o = "", l = 0, w = 10240;
        for (; l < data.byteLength / w; ++l)
            o += String.fromCharCode.apply(null, new Uint16Array(data.slice(l * w, l * w + w)));
        o += String.fromCharCode.apply(null, new Uint16Array(data.slice(l * w)));
        return o;
    }

    function s2ab(s) {
        var b = new ArrayBuffer(s.length * 2), v = new Uint16Array(b);
        for (var i = 0; i != s.length; ++i)
            v[i] = s.charCodeAt(i);
        return [v, b];
    }

    function loadExcelFile4(url)
    {
//        var url = "test_files/formula_stress_test_ajax.xlsx";
        var oReq = new XMLHttpRequest();
        oReq.open("GET", url, true);
        oReq.responseType = "arraybuffer";

        oReq.onload = function(e) {
            var arraybuffer = oReq.response;

            /* convert data to binary string */
            var data = new Uint8Array(arraybuffer);
            // console.log(data.length);
            var arr = new Array();
            for (var i = 0; i != data.length; ++i)
                arr[i] = String.fromCharCode(data[i]);
            var bstr = arr.join("");

            /* Call XLSX */
            var workbook = XLSX.read(bstr, {type: "binary"});
            // console.log(workbook);

            /* DO SOMETHING WITH workbook HERE */
        }

        oReq.send();
    }
    function loadExcelFile3(excelFilePath, version)
    {
        // console.log('load from excel');

        var jqxhr = $.ajax({
            url: excelFilePath,
            method: 'GET',
            responseType: "arraybuffer",
            processData: false,
            async: false
        });

        // console.log(jqxhr.responseText);
        var arraybuffer = jqxhr.responseText;
//        console.log(typeof(arraybuffer))
        /* convert data to binary string */
        var data = new Uint8Array(arraybuffer);
        // console.log(data);
        var arr = new Array();
        for (var i = 0; i != data.length; ++i)
            arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");
        // console.log(bstr);
        var workbook;
        /* Call XLS */
        if (version === 'xls')
            workbook = XLS.read(arraybuffer, {type: "binary"});
        else
            workbook = XLSX.read(arraybuffer, {type: "base64"});
        /* DO SOMETHING WITH workbook HERE */
        // console.log(workbook);
        return workbook;
    }

    function csvToColumns(csv)
    {
        var columns = {};
        for (var header in csv[0])
        {
            columns[header] = $.map(csv, function(item) {
                return item[header];
            });
        }
//        console.log(columns);
        return columns;
    }
    function process_columns(dataColumns)
    {
        // console.log(dataColumns);
        var columns = {};
        _.each(dataColumns, function(items, header) {

            var dataType = detectDataType(items);

            var listType = DATA_TYPES[dataType[0]];
//            console.log(listType);
            var column = listType(items, header, dataType[1]);
//            console.log(column);
            columns[header] = column;
        });
        return columns;
    }

    function cleanData(data)
    {
        _.each(data, function(d, i) {
            var x;
            data[i] = (!checkNull(d)) ? d : x;
        });
        return data;
    }

    function checkNull(value, exclude_empty)
    {
        return _.isUndefined(value) || _.isNaN(value) || _.isNull(value) || value === 'None'
                || value === 'null' || (value === '' && exclude_empty);
    }

    return mr;


}
;

function round(n, p)
{
    return Math.round(n * Math.pow(10, p)) / Math.pow(10, p);
}

function getSequence(data)
{
    var spectrum = [];
    var currentItem = {start: 0, end: 0, frequency: 0, value: data[0]};
    _.each(data, function(d, i) {
        if (d !== currentItem.value)
        {
            currentItem.end = i;
            currentItem.frequency = currentItem.end - currentItem.start;
            spectrum.push(_.clone(currentItem));
            currentItem.start = i;
            currentItem.value = d;
        }
    });
    currentItem.end = data.length;
    currentItem.frequency = currentItem.end - currentItem.start;
    spectrum.push(_.clone(currentItem));
    return spectrum;
}