import {
  Button,
  FileUpload,
  Form,
  FormGroup,
  Modal,
  ModalVariant,
  Popover,
  Radio,
  SelectVariant,
  Stack,
  StackItem,
  TextInput,
  Tooltip,
} from '@patternfly/react-core';
import {
  OutlinedQuestionCircleIcon,
  PlusCircleIcon,
  MinusCircleIcon,
} from '@patternfly/react-icons';
import { TableComposable, Tbody, Td, Tr } from '@patternfly/react-table';
import { global_Color_200, global_link_Color } from '@patternfly/react-tokens';
import { useFormik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { createUseStyles } from 'react-jss';
import Hide from '../../../../components/Hide/Hide';
import {
  isValidURL,
  mapFormikToAPIValues,
  mapValidationData,
  makeValidationSchema,
  FormikValues,
  maxUploadSize,
  failedFileUpload,
} from './helpers';
import useDebounce from '../../../../services/useDebounce';
import { useNotification } from '../../../../services/Notifications/Notifications';
import ContentValidity from './components/ContentValidity';
import {
  REPOSITORY_PARAMS_KEY,
  useAddContentQuery,
  useFetchGpgKey,
  useValidateContentList,
} from '../../../../services/Content/ContentQueries';
import { RepositoryParamsResponse } from '../../../../services/Content/ContentApi';
import DropdownSelect from '../../../../components/DropdownSelect/DropdownSelect';
import { useQueryClient } from 'react-query';
import ConditionalTooltip from '../../../../components/ConditionalTooltip/ConditionalTooltip';
import { useAppContext } from '../../../../middleware/AppContext';
import { isEmpty, isEqual } from 'lodash';

interface Props {
  isDisabled?: boolean;
}

const useStyles = createUseStyles({
  description: {
    paddingTop: '12px', // 4px on the title bottom padding makes this the "standard" 16 total padding
    color: global_Color_200.value,
  },
  removeSideBorder: {
    '&:after': {
      borderLeft: 'none!important',
    },
  },
  toggleAllRow: {
    composes: ['$removeSideBorder'],
    cursor: 'pointer',
    borderBottom: 'none!important',
    '& td': {
      color: global_link_Color.value + '!important',
      padding: '8px 0!important',
    },
    '& svg': {
      fill: global_link_Color.value + '!important',
      padding: '',
    },
  },
  colHeader: {
    '& td': {
      '&:not(:last-child)': { cursor: 'pointer' },
      padding: '8px 0!important',
    },
  },
  mainContentCol: {
    composes: ['$removeSideBorder'],
    padding: '16px 0px 16px 36px!important',
  },
  toggleAction: {
    composes: ['$removeSideBorder'],
    '& button': {
      padding: '8px',
    },
  },
  addRepositoryButton: {
    marginBottom: '24px',
  },
  saveButton: {
    marginRight: '36px',
    transition: 'unset!important',
  },
  removeButton: {
    display: 'flex!important',
    justifyContent: 'flex-end',
  },
  singleContentCol: {
    padding: '8px 0px 0px !important',
  },
});

const defaultValues: FormikValues = {
  name: '',
  url: '',
  gpgKey: '',
  arch: 'any',
  versions: ['any'],
  gpgLoading: false,
  expanded: true,
  metadataVerification: false,
};

const defaultTouchedState = { name: false, url: false, gpgKey: false };

const AddContent = ({ isDisabled: isButtonDisabled }: Props) => {
  const { hidePackageVerification, rbac } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [changeVerified, setChangeVerified] = useState(false);
  const [gpgKeyList, setGpgKeyList] = useState<Array<string>>(['']);
  const classes = useStyles();
  const queryClient = useQueryClient();
  const formik = useFormik({
    initialValues: [defaultValues],
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: makeValidationSchema(),
    initialTouched: [defaultTouchedState],
    onSubmit: () => undefined,
  });

  const updateGpgKey = (index: number, value: string) => {
    setChangeVerified(false);
    const updatedData: Array<string> = [...gpgKeyList];
    updatedData[index] = value;
    setGpgKeyList(updatedData);
  };

  const { fetchGpgKey, isLoading: isFetchingGpgKey } = useFetchGpgKey();

  const debouncedGpgKeyList = useDebounce(gpgKeyList, 300);

  const updateGpgKeyList = async (list: Array<string>) => {
    const updatedData = await Promise.all(
      [...formik.values].map(async (values, index) => {
        const updateValue = list[index];
        if (isValidURL(updateValue)) {
          const result = await fetchGpgKey(updateValue);
          // If successful
          if (result !== updateValue) {
            updateGpgKey(index, result);
            return {
              ...values,
              gpgKey: result,
              ...(!hidePackageVerification && values.gpgKey === '' && !!updateValue
                ? {
                    metadataVerification:
                      !!validationList?.[index]?.url?.metadata_signature_present,
                  }
                : {}),
            };
          }
        }
        return {
          ...values,
          gpgKey: updateValue,
          ...(!hidePackageVerification && values.gpgKey === '' && !!updateValue
            ? {
                metadataVerification: !!validationList?.[index]?.url?.metadata_signature_present,
              }
            : {}),
        };
      }),
    );

    formik.setValues(updatedData);
  };

  const { distribution_arches: distArches = [], distribution_versions: distVersions = [] } =
    queryClient.getQueryData<RepositoryParamsResponse>(REPOSITORY_PARAMS_KEY) || {};

  useEffect(() => {
    updateGpgKeyList(debouncedGpgKeyList);
  }, [debouncedGpgKeyList]);

  const { distributionArches, distributionVersions } = useMemo(() => {
    const distributionArches = {};
    const distributionVersions = {};
    distArches.forEach(({ name, label }) => (distributionArches[name] = label));
    distVersions.forEach(({ name, label }) => (distributionVersions[name] = label));
    return { distributionArches, distributionVersions };
  }, [distArches, distVersions]);

  const handleModalToggle = () => setIsModalOpen(!isModalOpen);

  const closeModal = () => {
    setIsModalOpen(false);
    formik.setTouched([defaultTouchedState]);
    formik.resetForm();
    setGpgKeyList(['']);
  };

  const { mutateAsync: addContent, isLoading: isAdding } = useAddContentQuery(
    queryClient,
    mapFormikToAPIValues(formik.values),
  );

  const createDataLengthOf1 = formik.values.length === 1;

  const allExpanded = !formik.values.some(({ expanded }) => !expanded);

  const expandAllToggle = () => {
    formik.setValues([...formik.values.map((vals) => ({ ...vals, expanded: !allExpanded }))]);
    setTouchedOnLastItemIfUntouchedAndCollapsed();
  };

  const updateVariable = (index: number, newValue, callback?: () => void) => {
    setChangeVerified(false);
    const updatedData = [...formik.values];
    updatedData[index] = { ...updatedData[index], ...newValue };
    formik.setValues(updatedData).then(callback);
  };

  const addRepository = () => {
    formik.setTouched([...formik.touched, defaultTouchedState]);
    formik.setValues([
      ...formik.values.map((vals) => ({ ...vals, expanded: false })),
      defaultValues,
    ]);
    setChangeVerified(false);
  };

  const removeRepository = (index: number) => {
    const newValues = formik.values;
    newValues.splice(index, 1);

    const newTouched = formik.touched;
    newTouched.splice(index, 1);

    const newErrors = formik.errors;
    newErrors.splice(index, 1);

    formik.setTouched(newTouched);
    formik.setErrors(newErrors);
    formik.setValues(newValues);
  };

  const getFieldValidation = (
    index: number,
    field: keyof FormikValues,
  ): 'default' | 'success' | 'error' => {
    const value = !!formik.values[index]?.[field];
    const errors = !!formik.errors[index]?.[field];
    const touched = formik.touched[index]?.[field];
    switch (true) {
      case errors && touched:
        return 'error';
      case value && touched:
        return 'success';
      default:
        return 'default';
    }
  };

  // The below sets the item as touched if the user closes the expansion without touching any fields
  // This is to ensure that the user understands that the item needs attention (and is in error)
  const setTouchedOnLastItemIfUntouchedAndCollapsed = () => {
    const lastItem = formik.touched?.length - 1 || 0;
    const { name, url } = formik.touched[lastItem] || {};
    if (!name && !url) {
      const updatedTouched = [...formik.touched];
      updatedTouched[lastItem] = { ...updatedTouched[lastItem], name: true, url: true };
      formik.setTouched(updatedTouched);
    }
  };

  let debouncedValues = useDebounce(formik.values) || []; // Initial value of []

  const {
    mutateAsync: validateContentList,
    data: validationList,
    isLoading: isValidating,
  } = useValidateContentList();

  useEffect(() => {
    // If validate is getting called to often, we could useDeepCompare
    if (isModalOpen) {
      if (debouncedValues.length !== formik.values.length) debouncedValues = formik.values;
      const newTouchedValues = [...formik.touched];
      validateContentList(
        debouncedValues.map(({ name, url, gpgKey, metadataVerification }, index) => {
          if (!newTouchedValues[index]?.name && name) {
            newTouchedValues[index] = { ...newTouchedValues[index], name: true };
          }
          if (!newTouchedValues[index]?.url && url) {
            newTouchedValues[index] = { ...newTouchedValues[index], url: true };
          }
          if (!newTouchedValues[index]?.gpgKey && gpgKey) {
            newTouchedValues[index] = { ...newTouchedValues[index], gpgKey: true };
          }
          return {
            name,
            url,
            gpg_key: gpgKey,
            metadata_verification: metadataVerification,
          };
        }),
      ).then(async (validationData) => {
        const formikErrors = await formik.validateForm(debouncedValues);
        const mappedErrorData = mapValidationData(validationData, formikErrors);
        formik.setErrors(mappedErrorData);
        setChangeVerified(true);
        formik.setTouched(newTouchedValues);
      });
    }
  }, [debouncedValues, debouncedValues.length, isModalOpen]);

  const onToggle = (index: number) => {
    if (formik.values[index]?.expanded) {
      updateVariable(index, { ...formik.values[index], expanded: false });
      setTouchedOnLastItemIfUntouchedAndCollapsed();
    } else updateVariable(index, { ...formik.values[index], expanded: true });
  };

  const updateArchAndVersion = (index: number) => {
    const url = formik.values[index]?.url;
    if (
      isValidURL(url) &&
      (formik.values[index]?.arch === 'any' || formik.values[index].versions[0] === 'any')
    ) {
      const arch =
        (formik.values[index]?.arch !== 'any' && formik.values[index]?.arch) ||
        distArches.find(({ name, label }) => url.includes(name) || url.includes(label))?.label ||
        'any';

      let versions: Array<string> = [];
      if (formik.values[index]?.versions?.length && formik.values[index].versions[0] !== 'any') {
        versions = formik.values[index]?.versions;
      } else {
        const newVersion = distVersions.find(
          ({ name, label }) => url.includes(name) || url.includes('/' + label),
        )?.label;
        if (newVersion) versions = [newVersion];
        if (isEmpty(versions)) versions = ['any'];
      }
      if (formik.values[index]?.arch !== arch && !isEqual(versions, formik.values[index]?.arch)) {
        const updatedData = [...formik.values];
        updatedData[index] = { ...updatedData[index], ...{ arch, versions } };
        formik.setValues(updatedData);
      }
    }
  };

  const setVersionSelected = (value: string[], index: number) => {
    let valueToUpdate = value.map((val) => distributionVersions[val]);
    if (value.length === 0 || valueToUpdate[value.length - 1] === 'any') {
      valueToUpdate = ['any'];
    }
    if (valueToUpdate.length > 1 && valueToUpdate.includes('any')) {
      valueToUpdate = valueToUpdate.filter((val) => val !== 'any');
    }

    updateVariable(index, {
      versions: valueToUpdate,
    });
  };

  const { notify } = useNotification();

  const actionTakingPlace = isFetchingGpgKey || isAdding || isValidating || !changeVerified;

  return (
    <>
      <ConditionalTooltip
        content='You do not have the required permissions to perform this action.'
        show={!rbac?.write}
        setDisabled
      >
        <Button
          id='createContentSourceButton'
          ouiaId='create_content_source'
          variant='primary'
          isDisabled={isButtonDisabled}
          onClick={handleModalToggle}
        >
          Add repositories
        </Button>
      </ConditionalTooltip>
      {isModalOpen ? (
        <Modal
          position='top'
          variant={ModalVariant.medium}
          title='Add custom repositories'
          ouiaId='add_custom_repository'
          ouiaSafe={!actionTakingPlace}
          help={
            <Popover
              headerContent={<div>Add a custom repository</div>}
              bodyContent={<div>Use this form to enter the values for a new repository.</div>}
            >
              <Button variant='plain' aria-label='Help'>
                <OutlinedQuestionCircleIcon />
              </Button>
            </Popover>
          }
          description={
            <p className={classes.description}>
              Add by completing the form. Default values may be provided automatically.
            </p>
          }
          isOpen
          onClose={closeModal}
          footer={
            <Stack>
              <StackItem>
                <Button
                  isDisabled={!formik.isValid || formik.values.length > 19}
                  className={classes.addRepositoryButton}
                  variant='link'
                  onClick={addRepository}
                  icon={<PlusCircleIcon />}
                  ouiaId='add_row'
                >
                  Add another repository
                </Button>
              </StackItem>
              <StackItem>
                <Button
                  className={classes.saveButton}
                  key='confirm'
                  ouiaId='modal_save'
                  variant='primary'
                  isLoading={isAdding}
                  isDisabled={
                    !changeVerified ||
                    !formik.isValid ||
                    isAdding ||
                    formik.values?.length !== debouncedValues?.length
                  }
                  onClick={() => addContent().then(closeModal)}
                >
                  Save
                </Button>
                <Button key='cancel' variant='link' onClick={closeModal} ouiaId='modal_cancel'>
                  Cancel
                </Button>
              </StackItem>
            </Stack>
          }
        >
          <TableComposable aria-label='Table for repo add modal' ouiaId='add_modal_table'>
            <Hide hide={createDataLengthOf1}>
              <Tbody isExpanded={allExpanded}>
                <Tr onClick={expandAllToggle} className={classes.toggleAllRow}>
                  <Td
                    className={classes.toggleAction}
                    isActionCell
                    expand={{
                      rowIndex: 0,
                      isExpanded: allExpanded,
                    }}
                  />
                  <Td dataLabel='expand-collapse'>{allExpanded ? 'Collapse all' : 'Expand all'}</Td>
                </Tr>
              </Tbody>
            </Hide>
            {formik.values.map(
              (
                { expanded, name, url, arch, gpgKey, versions, gpgLoading, metadataVerification },
                index,
              ) => (
                <Tbody key={index} isExpanded={createDataLengthOf1 ? undefined : expanded}>
                  <Hide hide={createDataLengthOf1}>
                    <Tr className={classes.colHeader}>
                      <Td
                        onClick={() => onToggle(index)}
                        className={classes.toggleAction}
                        isActionCell
                        expand={{
                          rowIndex: index,
                          isExpanded: expanded,
                        }}
                      />
                      <Td width={35} onClick={() => onToggle(index)} dataLabel={name}>
                        {name || 'New content'}
                      </Td>
                      <Td onClick={() => onToggle(index)} dataLabel='validity'>
                        <ContentValidity
                          touched={formik.touched[index]}
                          errors={formik.errors[index]}
                        />
                      </Td>
                      <Td dataLabel='removeButton' className={classes.removeButton}>
                        <Hide hide={formik.values.length === 1}>
                          <Button
                            onClick={() => removeRepository(index)}
                            variant='link'
                            icon={<MinusCircleIcon />}
                          >
                            Remove
                          </Button>
                        </Hide>
                      </Td>
                    </Tr>
                  </Hide>
                  <Tr isExpanded={createDataLengthOf1 ? undefined : expanded}>
                    <Td
                      colSpan={4}
                      className={
                        createDataLengthOf1 ? classes.singleContentCol : classes.mainContentCol
                      }
                    >
                      <Form>
                        <FormGroup
                          label='Name'
                          isRequired
                          fieldId='namegroup'
                          validated={getFieldValidation(index, 'name')}
                          helperTextInvalid={formik.errors[index]?.name}
                        >
                          <TextInput
                            isRequired
                            id='name'
                            name='name'
                            label='Name'
                            ouiaId='input_name'
                            type='text'
                            validated={getFieldValidation(index, 'name')}
                            onChange={(value) => {
                              updateVariable(index, { name: value });
                            }}
                            value={name || ''}
                            placeholder='Enter name'
                          />
                        </FormGroup>
                        <FormGroup
                          label='URL'
                          isRequired
                          fieldId='url'
                          validated={getFieldValidation(index, 'url')}
                          helperTextInvalid={formik.errors[index]?.url}
                        >
                          <TextInput
                            isRequired
                            type='url'
                            validated={getFieldValidation(index, 'url')}
                            onBlur={() => updateArchAndVersion(index)}
                            onChange={(value) => {
                              if (url !== value) {
                                updateVariable(index, { url: value });
                              }
                            }}
                            value={url || ''}
                            placeholder='https://'
                            id='url'
                            name='url'
                            label='Url'
                            ouiaId='input_url'
                          />
                        </FormGroup>
                        <FormGroup
                          label='Restrict architecture'
                          aria-label='restrict_to_architecture'
                          labelIcon={
                            <Tooltip content='Optional: Select value to restrict package architecture'>
                              <OutlinedQuestionCircleIcon
                                className='pf-u-ml-xs'
                                color={global_Color_200.value}
                              />
                            </Tooltip>
                          }
                          fieldId='arch'
                        >
                          <DropdownSelect
                            ouiaId='restrict_to_architecture'
                            menuAppendTo={document.body}
                            toggleId={'archSelection' + index}
                            options={Object.keys(distributionArches)}
                            variant={SelectVariant.single}
                            selectedProp={Object.keys(distributionArches).find(
                              (key: string) => arch === distributionArches[key],
                            )}
                            setSelected={(value) =>
                              updateVariable(index, { arch: distributionArches[value] })
                            }
                          />
                        </FormGroup>
                        <FormGroup
                          label='Restrict OS version'
                          aria-label='restrict_to_os_version'
                          labelIcon={
                            <Tooltip content='Optional: Select value to restrict package OS version'>
                              <OutlinedQuestionCircleIcon
                                className='pf-u-ml-xs'
                                color={global_Color_200.value}
                              />
                            </Tooltip>
                          }
                          fieldId='version'
                        >
                          <DropdownSelect
                            ouiaId='restrict_to_os_version'
                            menuAppendTo={document.body}
                            toggleId={'versionSelection' + index}
                            options={Object.keys(distributionVersions)}
                            variant={SelectVariant.typeaheadMulti}
                            selectedProp={Object.keys(distributionVersions).filter((key: string) =>
                              versions?.includes(distributionVersions[key]),
                            )}
                            placeholderText={versions?.length ? '' : 'Any version'}
                            setSelected={(value) => setVersionSelected(value, index)}
                          />
                        </FormGroup>
                        <FormGroup
                          label='GPG key'
                          labelIcon={
                            <Tooltip content='Optional: Add GPG Key file or URL'>
                              <OutlinedQuestionCircleIcon
                                className='pf-u-ml-xs'
                                color={global_Color_200.value}
                              />
                            </Tooltip>
                          }
                          fieldId='gpgKey'
                          validated={getFieldValidation(index, 'gpgKey')}
                          helperTextInvalid={formik.errors[index]?.gpgKey}
                        >
                          <FileUpload
                            validated={getFieldValidation(index, 'gpgKey')}
                            id='gpgKey-uploader'
                            aria-label='gpgkey_file_to_upload'
                            type='text'
                            filenamePlaceholder='Drag a file here or upload one'
                            textAreaPlaceholder='Paste GPG key or URL here'
                            value={gpgKeyList[index]}
                            isLoading={gpgLoading}
                            spellCheck={false}
                            onDataChange={(value) => updateGpgKey(index, value)}
                            onTextChange={(value) => updateGpgKey(index, value)}
                            onClearClick={() => updateGpgKey(index, '')}
                            dropzoneProps={{
                              maxSize: maxUploadSize,
                              onDropRejected: (files) => failedFileUpload(files, notify),
                            }}
                            allowEditingUploadedText
                            browseButtonText='Upload'
                          />
                        </FormGroup>
                        <Hide hide={hidePackageVerification || !gpgKey}>
                          <FormGroup
                            fieldId='metadataVerification'
                            label='Use GPG key for'
                            isInline
                          >
                            <Radio
                              isDisabled={
                                validationList?.[index]?.url?.metadata_signature_present !== true
                              }
                              id='package-verification-only'
                              name='package-verification-only'
                              label='Package verification only'
                              isChecked={!metadataVerification}
                              onChange={() =>
                                updateVariable(index, { metadataVerification: false })
                              }
                            />
                            <ConditionalTooltip
                              show={
                                validationList?.[index]?.url?.metadata_signature_present !== true
                              }
                              content="This repository's metadata is not signed, metadata verification is not possible."
                            >
                              <Radio
                                isDisabled={
                                  validationList?.[index]?.url?.metadata_signature_present !== true
                                }
                                id='package-and-repository-verification'
                                name='package-and-repository-verification'
                                label='Package and metadata verification'
                                isChecked={metadataVerification}
                                onChange={() =>
                                  updateVariable(index, { metadataVerification: true })
                                }
                              />
                            </ConditionalTooltip>
                          </FormGroup>
                        </Hide>
                      </Form>
                    </Td>
                  </Tr>
                </Tbody>
              ),
            )}
          </TableComposable>
        </Modal>
      ) : (
        ''
      )}
    </>
  );
};

export default AddContent;
