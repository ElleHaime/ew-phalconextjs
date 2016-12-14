Ext.define('Ext.ux.crud.Form', {
    extend: 'Ext.form.Panel',
    alias: ['widget.crudform'],
    requires: ['Ext.form.Panel','Ext.form.field.*'],
    isNew: true,

    constructor: function(config) {
        var me = this;

        config = config || {};
        config.trackResetOnLoad = true;
        me.callParent([config]);

        me.store = Ext.create(me.store, {
            storeId: me.store
        });

        me.dataStore = Ext.create('Ext.data.Store', {
            model: me.store.model
        });
    },

    listeners: {
        add: function(me, component, index) {
            if (component.isFormField) {
                component.on('change', me.handleFieldChanged, me, component);
            }
        }
    },

    handleFieldChanged: function(field) {
        var me = this,
            fieldName = field.getName(),
            fieldValue = field.getValue(),
            primaryName = me.getPrimaryField().getName(),
            record = me.getRecord();

            if (me.isNew === true) {
                return;
            }
            if (record == undefined) {
                return;
            }
            if (fieldName == primaryName) {
                return;
            }

            var id = record.getId();
            formRecord = me.dataStore.getById(id);
            if (formRecord == undefined) {
                return;
            }
            if (fieldValue == formRecord.get(fieldName)) {
                return;
            }
            values = me.getValues();
            //fields = record.prototype.fields.getRange();
            me.dataStore.getById(id).set(fieldName, fieldValue);
            me.disableSubmitButton(false);
    },

    onReset: function() {
        var me = this,
            fields = me.getAllFields();

        Ext.each(fields, function(field) {
            if (field.getName() !== me.primaryKey) {
                field.setValue('');
            }
        });
    },

    onClear: function() {
        var me = this,
            primary = me.getPrimaryField();

        primary.setValue('');
        primary.disable();
        me.isNew = true;
        me.onReset();
    },

    onSubmit: function() {
        var me = this;

        if (me.getForm().isValid()) {
            me.getForm().submit({
                url: me.url,
                parentForm: me,
                waitMsg: 'Saving...',
                success: function(form, action) {
                    var me = this;
                    //console.log(action.result);
                    if (action.result.success) {
                        if (me.parentForm.grid !== undefined) {
                            me.parentForm.grid.onReload();
                        }
                        if (action.result.id !== undefined) {
                            var oldId = me.parentForm.getRecord().getId();
                            var primary = me.parentForm.getPrimaryField();
                            primary.setValue(action.result.id);
                            var record = me.parentForm.dataStore.getById(oldId);
                            record.set(me.parentForm.primaryKey, action.result.id);
                        }
                        Ext.Msg.show({
                            title : '',
                            msg : action.result.msg,
                            icon : Ext.MessageBox.INFO,
                            buttons : Ext.Msg.OK
                        });
                    } else {
                        Ext.MessageBox.show({
                            title: 'Server error',
                            msg: action.result.error.join("\n"),
                            icon: Ext.MessageBox.ERROR,
                            buttons: Ext.Msg.OK
                        });
                    }
                },
                failure: function(form, action) {
                    var msg = ' Error';
                    switch (action.failureType) {
                        case Ext.form.action.Action.CLIENT_INVALID:
                            msg = 'Form fields may not be submitted with invalid values';
                            break;
                        case Ext.form.action.Action.CONNECT_FAILURE:
                            msg = 'Ajax communication failed';
                            break;
                        case Ext.form.action.Action.SERVER_INVALID:
                            if (action.result.error == undefined) {
                                if (action.result.msg && action.result.msg == "Access denied") {
                                    me.parentForm.grid.onReload();
                                    sleep(1);
                                    me.parentForm.sumbit();
                                }
                            } else {
                                msg = action.result.error.join("<br>");
                            }
                    }
                    Ext.MessageBox.show({
                        title: 'Server error',
                        msg: msg,
                        icon: Ext.MessageBox.ERROR,
                        buttons: Ext.Msg.OK
                    });
                }
            });
        }
    },

    setActiveRecord: function(record) {
        var me = this;

        me.activeRecord = record;
        if (record) {
            //me.down('#save').enable();
            var primary = me.getPrimaryField();
            primary.enable();
            me.loadItem(record);
        } else {
            me.onClear();
        }
    },

    disableSubmitButton: function(toogle) {
        var me = this,
            bbar = me.getDockedItems('toolbar[dock="bottom"]')[1],
            button = bbar.getComponent('btnSave');

        if (toogle === false) {
            console.log('Activate');
            button.disable(false);
            button.setDisabled(false);
        } else {
            console.log('Disable');
            button.disable();
            button.setDisabled(true);
        }
    },

    loadItem: function(gridRecord) {
        var me      = this,
            key = me.getPrimaryField().getName(),
            id = gridRecord.getId(),
            formRecord = me.dataStore.getById(id);

        me.isNew = false;
        if (formRecord != undefined) {
            me.getForm().loadRecord(formRecord);
            if (me.empty(formRecord.modified)) {
                me.disableSubmitButton(true);
            } else {
                me.disableSubmitButton(false);
            }
            return;
        }
        me.disableSubmitButton(true);

        var params = [];
        params[key] = id;
        /*store = Ext.create(me.store, {
            storeId: me.store
        });*/

        me.store.get({
            'params': params,
            'form': me,
            'callback': function(records, options, success) {
                options.form.getForm().loadRecord(records[0]);
                options.form.dataStore.add(records[0]);
            }
        });

        //return record;
    },

    getPrimaryField: function() {
        var me = this,
            fields = me.getAllFields();

        for (var i = 0, len = fields.length; i < len; i++) {
            if (fields[i].name === me.primaryKey) {
                return fields[i]
            }
        }

        return false;
    },

    getFieldByName: function(name) {
        var me = this,
            fields = me.getAllFields();

        for (var i = 0, len = fields.length; i < len; i++) {
            if (fields[i].name === name) {
                return fields[i]
            }
        }

        return false;
    },

    getAllFields: function(){
        var me = this,
            fields = me.getForm().getFields().items;

        return fields;
    },

    getLink: function () {
        var me = this,
            link = me.generateLinkFromTemplate(me.link, me.getAllFields());

        return link;
    },

    generateLinkFromTemplate: function (template, values, startDelimeter, endDelimeter) {
        startDelimeter = typeof startDelimeter !== 'undefined' ? startDelimeter : '{';
        endDelimeter = typeof endDelimeter !== 'undefined' ? endDelimeter : '}';

        for (i = 0; i < values.length; i++) {
            var pregString = new RegExp(startDelimeter + values[i].name + endDelimeter, 'g');
            var template = template.replace(pregString, values[i].value);
        }

        return template;
    },

    rtrim: function (str, charlist) {
        charlist = !charlist ? ' \s\u00A0' : (charlist + '').replace(/([\[\]\(\)\.\?\/\*\{\}\+$\^\:])/g, '\$1');
        var re = new RegExp('[' + charlist + ']+$', 'g');
        return (str + '').replace(re, '');
    },

    empty: function empty(mixed_var) {
        //  discuss at: http://phpjs.org/functions/empty/
        // original by: Philippe Baumann
        //    input by: Onno Marsman
        //    input by: LH
        //    input by: Stoyan Kyosev (http://www.svest.org/)
        // bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // improved by: Onno Marsman
        // improved by: Francesco
        // improved by: Marc Jansen
        // improved by: Rafal Kukawski
        //   example 1: empty(null);
        //   returns 1: true
        //   example 2: empty(undefined);
        //   returns 2: true
        //   example 3: empty([]);
        //   returns 3: true
        //   example 4: empty({});
        //   returns 4: true
        //   example 5: empty({'aFunc' : function () { alert('humpty'); } });
        //   returns 5: false

        var undef, key, i, len;
        var emptyValues = [undef, null, false, 0, '', '0'];

        for (i = 0, len = emptyValues.length; i < len; i++) {
            if (mixed_var === emptyValues[i]) {
                return true;
            }
        }

        if (typeof mixed_var === 'object') {
            for (key in mixed_var) {
                // TODO: should we check for own properties only?
                //if (mixed_var.hasOwnProperty(key)) {
                return false;
                //}
            }
            return true;
        }

        return false;
    }

});