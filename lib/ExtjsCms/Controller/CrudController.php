<?php
/**
 * @namespace
 */
namespace ExtjsCms\Controller;

use Phalcon\Mvc\View;

/**
 * @RoutePrefix("/admin", name="home")
 */
//@Acl(actions={"read","update","save","delete","json","options"}, options={"crud_operations"})
class CrudController extends Base
{
    /**
     * Initializes the controller
     */
    public function initialize()
    {
        if (!$this->_checkAccess()) {
            $this->dispatcher->forward([
                "controller" => 'admin',
                "action" => 'denied'
            ]);
        }
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}/get", methods={"GET", "POST"}, name="grid-read")
     */
    public function getAction($module, $form)
    {
        $params = $this->_getParams();
        $formName = $this->_getForm($module, $form);
        $form = new $formName(null, [], $this->getDi(), $this->getEventsManager());
        $primary = $form->getPrimaryField();
        $result = [];
        if (!$primary) {
            $result['error'] = "Primary field didn't find!";
        } elseif (!isset($params[$primary->getKey()])) {
            $result['error'] = "Primary value didn't find in request params";
        } elseif (!$form->loadData($params[$primary->getKey()])) {
            $result['error'] = "Item didn't find";
        } else {
            $result = $form->getGridData();
        }

        echo json_encode($result);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudGrid:[a-z,-]+}/read", methods={"GET", "POST"}, name="grid-read")
     */
    public function readAction($module, $grid)
    {
        $params = $this->_getParams();
        $gridName = $this->_getGrid($module, $grid);
        $grid = new $gridName($params, $this->getDi(), $this->getEventsManager());

        echo $grid->getDataWithRenderValues();

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}/save", methods={"POST"}, name="grid-update")
     */
    public function saveAction($module, $form)
    {
        $params = $this->_getParams();
        $formName = $this->_getForm($module, $form);

        $result = forward_static_call_array([$formName, 'updateRow'], [$params, $this->getDi(), $this->getEventsManager()]);
        if (empty($result['error'])) {
            $result['msg'] = 'Saved';
        }
        echo json_encode($result);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}/update", methods={"POST"}, name="grid-update")
     */
    public function updateAction($module, $form)
    {
        $params = $this->request->getRawBody();
        $formName = $this->_getForm($module, $form);

        $result = forward_static_call_array([$formName, 'updateRows'], [$params, $form, $this->getDi(), $this->getEventsManager()]);

        echo json_encode($result);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}/delete", methods={"POST"}, name="grid-update")
     */
    public function deleteAction($module, $form)
    {
        $params = $this->request->getRawBody();
        $formName = $this->_getForm($module, $form);
        $result = forward_static_call_array([$formName, 'deleteRows'], [$params, $form, $this->getDi(), $this->getEventsManager()]);

        echo json_encode($result);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/json/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}", methods={"GET"}, name="grid-json")
     */
    public function jsonAction($module, $model)
    {
        $modelName = $this->_getModel($module, $model);
        $result = forward_static_call([$modelName, 'find']);
        $result = $result->toArray();
        $result = \Engine\Tools\Arrays::resultArrayToJsonType($result, 'id', 'name');

        echo json_encode([$model => $result]);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}/{formField:[a-z,-,_]+}/options", methods={"GET"}, name="grid-options-json")
     */
    public function optionsAction($module, $form, $field)
    {
        $formName = $this->_getForm($module, $form);
        $key = $form;
        $form = new $formName(null, [], $this->getDi(), $this->getEventsManager());
        $field = $form->getFieldByKey($field);
        if (!$field instanceof \Engine\Crud\Form\Field\ArrayToSelect) {
            throw new \Engine\Exception("Field not instance of 'ArrayToSelect' field type");
        }

        $result = $field->getOptions();
        $result = \Engine\Tools\Arrays::assocToArray($result, 'id', 'name');

        echo json_encode([$key => $result]);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudForm:[a-z,-]+}/{formField:[a-z,-,_]+}/multi-options", methods={"GET"}, name="grid-options-json")
     */
    public function multiOptionsAction($module, $form, $field)
    {
        $params = $this->request->getQuery();
        $formName = $this->_getForm($module, $form);
        $key = $form;
        $form = new $formName(null, [], $this->getDi(), $this->getEventsManager());
        $field = $form->getFieldByKey($field);
        if (!$field instanceof \Engine\Crud\Form\Field\ManyToMany) {
            throw new \Engine\Exception("Field not instance of 'ArrayToSelect' field type");
        }

        $result = $field->getOptions($params);
        $count = $field->getCount($params);
        $result = \Engine\Tools\Arrays::assocToArray($result, 'id', 'name');

        echo json_encode([$key => $result, 'results' => $count]);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

    /**
     * @Route("/{crudModule:[a-z,-]+}/{crudGrid:[a-z,-]+}/{filterField:[a-z,-,_]+}/filter-options", methods={"GET"}, name="grid-options-json")
     */
    public function filterOptionsAction($module, $grid, $field)
    {
        $gridName = $this->_getGrid($module, $grid);
        $key = $grid;
        $grid = new $gridName([], $this->getDi(), $this->getEventsManager());
        $form = $grid->getFilter();
        $field = $form->getFieldByKey($field);
        if (!$field instanceof \Engine\Crud\Grid\Filter\Field\ArrayToSelect) {
            throw new \Engine\Exception("Field not instance of 'ArrayToSelect' field type");
        }

        $result = $field->getOptions();
        $result = \Engine\Tools\Arrays::assocToArray($result, 'id', 'name');

        echo json_encode([$key => $result]);

        $this->view->setRenderLevel(View::LEVEL_NO_RENDER);
    }

}