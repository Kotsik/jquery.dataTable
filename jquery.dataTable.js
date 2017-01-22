var DataTable = function (element, options) {
    this.$element = $(element);
    this.options = $.extend({}, $.fn.dataTable.defaults, options);
    this.content = '';
    this.pagination = '';
    this.data = {};
    this.totalCount = 0;
    this.init();

    return this;
}

DataTable.prototype.init = function(){
    var dataTable = this;
    var sleep;

    if (this.options.source != ''){
        var filter = {};
        for (var key in this.options.filters) {

            var reloadTable = function(){
                clearInterval(sleep);
                sleep = setTimeout(function(){
                    dataTable.options.page = 1;
                    dataTable.init();
                }, 700);
            }

            this.options.filters[key].off('keyup, change').on('keyup, change', reloadTable);
            filter[key] = this.options.filters[key].val();
        }

        var offset = (this.options.page - 1) * this.options.limit;

        // loading
        var tdCount = $('thead th', this.$element).size();
        var loading = '<tr><td colspan="' + tdCount + '" style="text-align: center">' +
            '<div class="progress progress-striped active" style="width: 20%; margin: 5px auto;">' +
            '<div class="bar" style="width: 100%; line-height: 20px;">Загрузка...</div>' +
            '</div>' +
            '</td></tr>';

        var cookieName = window.location.pathname.split('/').join('') + '_' + this.$element.attr('id') + '_orderby';
        this.options.orderby = $.parseJSON($.cookie(cookieName)) ||  this.options.orderby;

        var cookieName = window.location.pathname.split('/').join('') + '_' + this.$element.attr('id') + '_limit';
        this.options.limit = $.parseJSON($.cookie(cookieName)) ||  this.options.limit;

        // Table headers init
        dataTable.renderHeader();

        $('tbody', this.$element).html(loading);

        $.ajax({
            url: this.options.source,
            data: {
                options: {
                    orderby: this.options.orderby,
                    limit: this.options.limit,
                    offset: offset,
                    filters: filter,
                    data: this.options.data
                }
            },
            success: function(res){
                if (res.status == 'ok'){
                    dataTable.data = res.data;
                    dataTable.totalCount = res.data.totalCount;
                    dataTable.render(res.data.data);
                } else {
                    var count = $('thead th', this.$element).size();
                    $('tbody', this.$element).html('<tr><td colspan=' + count + '>' + this.options.notFound + '</td></tr>');
                }

                dataTable.options.onRender(res);
            }
        });
    }
}

DataTable.prototype.render = function(data){
    var dataTable = this;
    this.content = '';

    if (data.length > 0){
        for (key in data) {
            this.renderRow(data[key])
        }
        this.pagination = this.buildPagination();

        $('tbody', this.$element).html(this.content);

        this.removePagination();

        if (this.pagination != ''){
            $(this.$element).after(this.pagination);
            var pagination = $(this.$element).next();

            $('.pages button.btn', pagination).click(function(){
                if (!$(this).hasClass('active')){
                    dataTable.options.page = parseInt($(this).html());
                    dataTable.init();
                    return false;
                }
            });

            if (dataTable.options.limitChangeEnabled) {
                $('.paginationLimit a').click(function () {
                    var limit = $(this).data('value');
                    if (limit != dataTable.options.limit) {
                        dataTable.options.limit = parseInt(limit);
                        var cookieName = window.location.pathname.split('/').join('') + '_' + dataTable.$element.attr('id') + '_limit';
                        $.cookie(cookieName, JSON.stringify(dataTable.options.limit));
                        dataTable.init();
                        return false;
                    }
                });
            }
        }
    } else {
        var tdCount = $('thead th', this.$element).size();
        this.removePagination();
        this.content = '<tr><td colspan="' + tdCount + '" style="text-align: center">' +
            this.options.notFound +
            '</td></tr>';
        $('tbody', this.$element).html(this.content);
    }
}

DataTable.prototype.renderRow = function(row){
    var line = '';

    if (row !== undefined && row.class !== undefined){
        line += '<tr class="' + row.class + '">';
        delete row.class;
    } else {
        line += '<tr>';
    }

    var once = false
    for (key in row) {
        /* Strange Safari bug fix */
        if (once && key == 0) break;
        once = true;

        line += '<td';

        if (this.options.cols[key] !== undefined && this.options.cols[key].class !== undefined){
            line += ' class="' + this.options.cols[key].class + '"';
        }
        if (this.options.cols[key] !== undefined && this.options.cols[key].width !== undefined){
            line += ' style="width: ' + this.options.cols[key].width + '"';
        }
        line += '>' + row[key] + '</td>';
    }
    line += '</tr>';
    this.content += line;

    return line;
}

DataTable.prototype.renderHeader = function(){
    var dataTable = this;
    var dataTableId = dataTable.$element.attr('id');

    $('thead th', dataTable.$element).removeClass('sort').removeClass('asc').removeClass('desc');

    for (var key in dataTable.options.cols) {
        if (dataTable.options.cols[key].sortable == undefined
            || ( dataTable.options.cols[key].sortable !== undefined && dataTable.options.cols[key].sortable)) {
            var hCol = $('thead th:eq(' + key + ')', dataTable.$element);
            if (dataTable.options.cols[key].order != false) hCol.addClass('sort');
            for (var sortKey in dataTable.options.orderby) {
                if (dataTable.options.orderby[sortKey][0] == parseInt(key) + 1) {
                    hCol.addClass(dataTable.options.orderby[sortKey][1].toLowerCase());
                }
            }
        }
    }

    $(document).off('click', '#' + dataTableId + '.dataTable th.sort').on('click', '#' + dataTableId + '.dataTable th.sort', function(e) {
        if ($(this).hasClass('asc')){
            dataTable.options.orderby = [[$(this).index() + 1, 'desc']];
        } else {
            dataTable.options.orderby = [[$(this).index() + 1, 'asc']];
        }

        var cookieName = window.location.pathname.split('/').join('') + '_' + dataTable.$element.attr('id') + '_orderby';
        $.cookie(cookieName, JSON.stringify(dataTable.options.orderby));
        dataTable.init();
    });
}

DataTable.prototype.buildPagination = function(){
    var pagination = '';
    var paused = false;
    var page = this.options.page;

    var pages = Math.ceil(this.totalCount / this.options.limit);

    pagination += '<div class="btn-toolbar dataTable_pagination">';

    if (pages > 1){
        pagination += '<div class="pages btn-group">';
        for (var i = 1; i <= pages; i++) {
            if ((i > 2 && i < page - 2) || (i < pages-2 && i > page + 2)) {
                if (!paused){
                    pagination += '</div>';
                    paused = true;
                }
                continue;
            }

            if (paused) {
                pagination += '<div class="btn-group">';
                paused = false;
            }
            pagination += '<button class="btn';
            if (i == page) pagination += ' active';
            pagination += '">' + i + '</button>';
        }
        pagination += '</div>';

    }

    if (this.options.limitChangeEnabled) {
        pagination += '<div class="btn-group paginationLimit">'
            + '<button class="btn title">' + this.options.limit + '</button>'
            + '<button class="btn dropdown-toggle" data-toggle="dropdown">'
            + '<span class="caret"></span>'
            + '</button>'
            + '<ul class="dropdown-menu">'
            + '<li><a href="javascript:;" data-value="10" data-id="limit">10</a></li>'
            + '<li><a href="javascript:;" data-value="20" data-id="limit">20</a></li>'
            + '<li><a href="javascript:;" data-value="50" data-id="limit">50</a></li>'
            + '<li><a href="javascript:;" data-value="100" data-id="limit">100</a></li>'
            + '</ul>'
            + '</div>';
    }

    pagination += '</div>';

    return pagination;
}

DataTable.prototype.removePagination = function(){
    if ($(this.$element).next().hasClass('dataTable_pagination')) {
        $(this.$element).next().remove();
    }
}

$.fn.dataTable = function(options) {
    return new DataTable(this, options);
}

$.fn.dataTable.Constructor = DataTable;

$.fn.dataTable.defaults = {
    onRender: function(){},
    orderby: [],
    source: '',
    cols: [],
    limit: 50,
    page: 1,
    filters: {},
    notFound: 'не найдено ни одной записи',
    limitChangeEnabled: true
}