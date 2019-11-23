import * as _ from 'lodash';
import React from 'react';
import { Button, Modal, Form, Input, Alert, Typography } from 'antd';
import * as shortid from 'shortid';
import { SpanGroupingRawOptions, SpanGroupingOptions } from '../../../model/span-grouping/span-grouping';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import TypeScriptManager from '../typescript-manager';
import Stage from '../../../model/stage';
import { Span } from '../../../model/interfaces';


const { Text } = Typography;
const styles = {
  formItem: {
    marginBottom: 16
  },
  formItemInput: {
    width: '100%'
  },
};

const formItemProps = {
  labelCol: { span: 6 },
  wrapperCol: { span: 16 },
  style: styles.formItem
};

export interface SpanGroupingFormModalProps {
  visible: boolean,
  onSave: (options: SpanGroupingOptions, rawOptions: SpanGroupingRawOptions, isNew: boolean) => void,
  onCancel: () => void,
  form: any,
  rawOptions?: SpanGroupingRawOptions,
  hideNameField?: boolean,
  modalTitle?: string,
}

export const SpanGroupingFormModal: any = Form.create({
  name: 'span-grouping-form-modal',
  mapPropsToFields: (props: any) => _.mapValues(props.dataSource || {}, (value) => Form.createFormField({ value }))
})(
  class extends React.Component<SpanGroupingFormModalProps> {
    private editorContainerEl?: HTMLDivElement;
    private model?: monaco.editor.ITextModel;
    private editor?: monaco.editor.IStandaloneCodeEditor;
    private editorContentChangeListener?: monaco.IDisposable;
    private tsManager = TypeScriptManager.getSingleton();
    private stage = Stage.getSingleton();

    state = {
      isTesting: false,
      testError: undefined as (Error | undefined),
      testResult: undefined as {
        tsCode: string,
        compiledJSCode: string,
        groupBy: Function,
        testedSpans: { span: Span, rv: string }[]
      } | undefined,
    };

    private binded = {
      onSaveButtonClick: this.onSaveButtonClick.bind(this),
      setElementContainerRef: this.setElementContainerRef.bind(this),
      onTestButtonClick: this.onTestButtonClick.bind(this),
      onMonacoEditorContentChange: _.throttle(this.onMonacoEditorContentChange.bind(this), 100),
    };

    setElementContainerRef(el: HTMLDivElement) {
      this.editorContainerEl = el;

      if (this.editorContainerEl) {
        this.init();
      } else {
        this.dispose();
      }
    }

    init() {
      if (!this.editorContainerEl) return;

      this.setState({
        isTesting: false,
        testError: undefined,
        testResult: undefined,
      });

      const code = this.props.rawOptions ?
        this.props.rawOptions.rawCode :
        `// Do something with "span" and "trace"\n` +
        `// and return a tuple [groupId, groupName]\n` +
        `// where groupId is a unique string to be used for grouping\n` +
        `// and groupName is human readable string for displaying\n` +
        `function groupBy(span: Span, trace: Trace): [string, string] {\n` +
        `    // Let's group by service name\n` +
        `    let serviceName = 'unknown';\n\n` +
        `    // Handle jaeger spans\n` +
        `    if (span.process && span.process.serviceName) {\n` +
        `        serviceName = span.process.serviceName;\n` +
        `    }\n\n` +
        `    // Handle zipkin spans\n` +
        `    if (span.localEndpoint && span.localEndpoint.serviceName) {\n` +
        `        serviceName = span.localEndpoint.serviceName;\n` +
        `    }\n\n` +
        `    return [serviceName, serviceName];\n` +
        `}\n`;

      this.model = monaco.editor.createModel(code, 'typescript');
      this.editor = monaco.editor.create(this.editorContainerEl, {
        minimap: { enabled: false }
      });
      this.editor.setModel(this.model);

      this.editorContentChangeListener = this.model.onDidChangeContent(this.binded.onMonacoEditorContentChange);
    }

    dispose() {
      this.editor && this.editor.dispose();
      this.model && this.model.dispose();
      this.editorContentChangeListener && this.editorContentChangeListener.dispose();
      this.editor = undefined;
      this.model = undefined;
      this.editorContentChangeListener = undefined;
    }

    async onSaveButtonClick() {
      const { rawOptions } = this.props;

      this.props.form.validateFields(async (err: Error, values: any) => {
        if (err) return;
        if (!this.state.testResult) return;

        const key = (rawOptions && rawOptions.key) || shortid.generate();
        const name = values.name || (rawOptions && rawOptions.name);

        this.props.onSave(
          {
            key,
            name,
            groupBy: this.state.testResult.groupBy as any
          },
          {
            key,
            name,
            rawCode: this.state.testResult.tsCode,
            compiledCode: this.state.testResult.compiledJSCode,
          },
          !this.props.rawOptions
        );
      });
    }

    async onTestButtonClick() {
      if (!this.editor) return; // TODO: Error
      this.setState({ isTesting: true, testResult: undefined, testError: undefined });

      try {
        const result = await this.test();
        this.setState({
          isTesting: false,
          testError: undefined,
          testResult: result,
        });

        return true;
      } catch (err) {
        this.setState({
          isTesting: false,
          testError: err,
          testResult: undefined,
        });

        return false;
      }
    }

    async test() {
      if (!this.model) throw new Error('Monaco text model is not ready');
      if (!this.editor) throw new Error('Monaco editor is not ready');
      const tsCode = this.editor.getValue();
      const compiledJSCode = await this.tsManager.compile(this.model.uri);

      let groupByFn: Function | undefined = undefined;
      try {
        groupByFn = TypeScriptManager.generateFunction(compiledJSCode, 'groupBy');
      } catch(err) {
        if (err.message == `groupBy is not defined`) {
          const customErr = new Error(`Unexpected "groupBy" function`);
          (customErr as any).description = `You have to declare a function named "groupBy" and it has to return a tuple [string, string].`;
          throw customErr;
        }

        throw err;
      }

      if (!_.isFunction(groupByFn)) {
        const err = new Error(`Unexpected "groupBy" function`);
        (err as any).description = `You have to declare a function named "groupBy" and it has to return a tuple [string, string].`;
        throw err;
      }

      const testedSpans: { span: Span, rv: string[] }[] = [];
      const tracesToTest = this.stage.getAllTraces();
      for (let trace of tracesToTest) {
        for (let span of trace.spans) {
          const rv = groupByFn(span, trace);
          if (!_.isArray(rv)) {
            console.error(`Return value of "groupBy" function must be string tuple, but recieved "${typeof rv}" for span`, span);
            const err = new Error(`Function returned not a string`);
            (err as any).description = `Return value of "groupBy" function has to be a string tuple, but got "${typeof rv}" ` +
              `for a span. Please check your console for further details. Press Command+Option+I or Ctrl+Option+I to ` +
              `open devtools.`;
            throw err;
          }
          testedSpans.push({ span, rv });
        }
      }


      return { tsCode, compiledJSCode, groupBy: groupByFn, testedSpans };
    }

    onMonacoEditorContentChange() {
      this.setState({ testResult: undefined, testError: undefined });
    }

    render() {
      const { visible, onCancel, form, rawOptions, modalTitle, hideNameField } = this.props;
      const { isTesting, testResult, testError } = this.state;
      const { getFieldDecorator } = form;

      return (
        <Modal
          visible={visible}
          destroyOnClose={true}
          maskClosable={false}
          title={modalTitle || (rawOptions ? 'Update span grouping' : 'New span grouping')}
          onCancel={onCancel}
          onOk={this.binded.onSaveButtonClick}
          width={600}
          footer={[
            <Button
              key="test"
              type="default"
              loading={isTesting}
              onClick={this.binded.onTestButtonClick}
            >
              Test
            </Button>,
            <Button
              key="submit"
              type="primary"
              disabled={!testResult || isTesting || !!testError}
              onClick={this.binded.onSaveButtonClick}
            >
              Save
            </Button>
          ]}
        >
          <Form layout="horizontal">
            {!hideNameField && (
              <Form.Item label="Name" {...formItemProps}>
                {getFieldDecorator('name', {
                  rules: [{ required: true, whitespace: true, message: 'Please enter name for span grouping' }],
                })(<Input style={styles.formItemInput} placeholder="Custom grouping" />)}
              </Form.Item>
            )}

            <Form.Item>
              <div
                ref={this.binded.setElementContainerRef}
                style={{ width: '100%', height: 150 }}
              ></div>
            </Form.Item>

            {this.renderTestResult()}
          </Form>
        </Modal>
      );
    }

    renderTestResult() {
      const { testResult, testError } = this.state;

      if (testError) {
        return (
          <Alert
            message={testError.message}
            description={(testError as any).description || ''}
            type="error"
            showIcon
          />
        );
      }

      if (testResult) {
        const alertType = testResult.testedSpans.length > 0 ? 'success' : 'warning';
        const message = testResult.testedSpans.length > 0 ? 'Test successful' : 'No spans in the stage to test';
        let description: string | JSX.Element = '';

        if (testResult.testedSpans.length > 0) {
          description = (
            <>
              Span grouping function seems OK. It's tested on {testResult.testedSpans.length} span(s) in
              the stage and here are some samples: <br /><br />
              <ul>
                {_.sampleSize(testResult.testedSpans, 5).map((test) => (
                  <li key={test.span.id}>
                    {test.span.operationName} => <Text code>{JSON.stringify(test.rv)}</Text>
                  </li>
                ))}
              </ul>
            </>
          );
        } else {
          description = `Span grouping function seems OK, you can save it. However it's not tested on any real ` +
            `spans, since there is no trace added to the stage.`;
        }

        return (
          <Alert
            message={message}
            description={description}
            type={alertType}
            showIcon
          />
        );
      }

      return null;
    }
  }
);

export default SpanGroupingFormModal;
