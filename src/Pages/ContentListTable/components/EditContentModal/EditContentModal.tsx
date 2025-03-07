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
import { CheckCircleIcon, OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { TableComposable, Tbody, Td, Tr } from '@patternfly/react-table';
import {
  global_Color_200,
  global_success_color_100,
  global_link_Color,
} from '@patternfly/react-tokens';
import { useFormik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { createUseStyles } from 'react-jss';
import Hide from '../../../../components/Hide/Hide';
import useDebounce from '../../../../services/useDebounce';
import {
  REPOSITORY_PARAMS_KEY,
  useEditContentQuery,
  useFetchGpgKey,
  useValidateContentList,
} from '../../../../services/Content/ContentQueries';
import { RepositoryParamsResponse } from '../../../../services/Content/ContentApi';
import DropdownSelect from '../../../../components/DropdownSelect/DropdownSelect';
import { useQueryClient } from 'react-query';
import {
  failedFileUpload,
  isValidURL,
  makeValidationSchema,
  mapValidationData,
  maxUploadSize,
} from '../AddContent/helpers';
import ContentValidity from '../AddContent/components/ContentValidity';
import {
  EditContentProps,
  FormikEditValues,
  mapFormikToEditAPIValues,
  mapToDefaultFormikValues,
} from './helpers';
import { isEmpty, isEqual } from 'lodash';
import ConditionalTooltip from '../../../../components/ConditionalTooltip/ConditionalTooltip';
import { useAppContext } from '../../../../middleware/AppContext';
import { useNotification } from '../../../../services/Notifications/Notifications';

const green = global_success_color_100.value;

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
      padding: '12px 0!important',
    },
    '& svg': {
      fill: global_link_Color.value + '!important',
      padding: '',
    },
  },
  colHeader: {
    '& td': {
      '&:not(:last-child)': { cursor: 'pointer' },
      padding: '12px 0!important',
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
  saveButton: {
    marginRight: '36px',
    transition: 'unset!important',
  },
  singleContentCol: {
    padding: '8px 0px 0px !important',
  },
});

const EditContentModal = ({ values, open, setClosed }: EditContentProps) => {
  if (!open) return <></>;
  const { hidePackageVerification } = useAppContext();
  const initialValues = mapToDefaultFormikValues(values);
  const [changeVerified, setChangeVerified] = useState(false);
  const [gpgKeyList, setGpgKeyList] = useState<Array<string>>(
    initialValues.map(({ gpgKey }) => gpgKey),
  );
  const classes = useStyles();
  const queryClient = useQueryClient();
  const formik = useFormik({
    initialValues: initialValues,
    validateOnBlur: false,
    validateOnChange: false,
    validationSchema: makeValidationSchema(),
    initialTouched: values.map(() => ({ name: true, url: true })),
    onSubmit: () => undefined,
  });

  const valuesHaveChanged = useMemo(
    () => !isEqual(initialValues, formik.values),
    [initialValues, formik.values],
  );

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

  const closeModal = () => {
    setClosed();
    formik.resetForm();
    setGpgKeyList(['']);
  };

  const { mutateAsync: editContent, isLoading: isEditing } = useEditContentQuery(
    queryClient,
    mapFormikToEditAPIValues(formik.values),
  );

  const createDataLengthOf1 = formik.values.length === 1;

  const allExpanded = !formik.values.some(({ expanded }) => !expanded);

  const expandAllToggle = () => {
    formik.setValues([...formik.values.map((vals) => ({ ...vals, expanded: !allExpanded }))]);
  };

  const updateVariable = (index: number, newValue) => {
    setChangeVerified(false);
    const updatedData = [...formik.values];
    updatedData[index] = { ...updatedData[index], ...newValue };
    formik.setValues(updatedData);
  };

  const getFieldValidation = (
    index: number,
    field: keyof FormikEditValues,
  ): 'default' | 'success' | 'error' => {
    const hasNotChanged = isEqual(initialValues[index]?.[field], formik.values[index]?.[field]);
    const errors = !!formik.errors[index]?.[field];
    switch (true) {
      case errors:
        return 'error';
      case hasNotChanged:
        return 'default';
      case !hasNotChanged:
        return 'success';
      default:
        return 'default';
    }
  };

  const debouncedValues = useDebounce(formik.values);

  const {
    mutateAsync: validateContentList,
    data: validationList,
    isLoading: isValidating,
  } = useValidateContentList();

  useEffect(() => {
    if (open)
      validateContentList(
        debouncedValues.map(({ name, url, gpgKey, metadataVerification, uuid }) => ({
          name,
          url,
          gpg_key: gpgKey,
          metadata_verification: metadataVerification,
          uuid,
        })),
      ).then(async (validationData) => {
        const formikErrors = await formik.validateForm(debouncedValues);
        const mappedErrorData = mapValidationData(validationData, formikErrors);
        formik.setErrors(mappedErrorData);
        setChangeVerified(true);
      });
  }, [debouncedValues, values, open]);

  const onToggle = (index: number) => {
    if (formik.values[index]?.expanded) {
      updateVariable(index, { ...formik.values[index], expanded: false });
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

  const urlOnBlur = (index: number) => {
    updateArchAndVersion(index);
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

  const actionTakingPlace = isFetchingGpgKey || isEditing || isValidating || !changeVerified;

  return (
    <Modal
      position='top'
      variant={ModalVariant.medium}
      title='Edit custom repository'
      ouiaId='edit_custom_repository'
      ouiaSafe={!actionTakingPlace}
      help={
        <Popover
          headerContent={<div>Edit custom repository</div>}
          bodyContent={<div>Use this form to edit the values of an existing repository.</div>}
        >
          <Button variant='plain' aria-label='Help'>
            <OutlinedQuestionCircleIcon />
          </Button>
        </Popover>
      }
      description={
        <p className={classes.description}>
          Edit by completing the form. Default values may be provided automatically.
        </p>
      }
      isOpen={open}
      onClose={closeModal}
      footer={
        <Stack>
          <StackItem>
            <Button
              className={classes.saveButton}
              key='confirm'
              ouiaId='edit_modal_save'
              variant='primary'
              isLoading={isEditing}
              isDisabled={
                !changeVerified ||
                !formik.isValid ||
                isEditing ||
                !valuesHaveChanged ||
                !isEqual(formik.values, debouncedValues)
              }
              onClick={() => {
                editContent().then(closeModal);
              }}
            >
              {valuesHaveChanged ? 'Save changes' : 'No changes'}
            </Button>
            <Button key='cancel' variant='link' onClick={closeModal} ouiaId='edit_modal_cancel'>
              Cancel
            </Button>
          </StackItem>
        </Stack>
      }
    >
      <TableComposable aria-label='Table for edit modal' ouiaId='edit_modal_table'>
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
                        onBlur={() => urlOnBlur(index)}
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
                        validated={getFieldValidation(index, 'arch')}
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
                        validated={getFieldValidation(index, 'versions')}
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
                      <FormGroup fieldId='metadataVerification' label='Use GPG key for' isInline>
                        <Radio
                          isDisabled={
                            validationList?.[index]?.url?.metadata_signature_present !== true
                          }
                          id='package verification only'
                          name='package-verification-only'
                          label='Package verification only'
                          isChecked={!metadataVerification}
                          onChange={() => updateVariable(index, { metadataVerification: false })}
                        />
                        <ConditionalTooltip
                          show={validationList?.[index]?.url?.metadata_signature_present !== true}
                          content="This repository's metadata is not signed, metadata verification is not possible."
                        >
                          <Radio
                            isDisabled={
                              validationList?.[index]?.url?.metadata_signature_present !== true
                            }
                            id='Package and metadata verification'
                            name='package-and-repository-verification'
                            label='Package and metadata verification'
                            isChecked={metadataVerification}
                            onChange={() => updateVariable(index, { metadataVerification: true })}
                          />
                        </ConditionalTooltip>
                        <Hide
                          hide={getFieldValidation(index, 'metadataVerification') !== 'success'}
                        >
                          <CheckCircleIcon noVerticalAlign color={green} />
                        </Hide>
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
  );
};

export default EditContentModal;
