import { useCallback, useState } from "react";

/**
 * Подтверждение как промис: `if (await confirm({...}))`.
 *
 * Иначе каждое опасное действие требовало бы трёх состояний (открыт ли
 * диалог, что подтверждаем, что делать при согласии) и ветвления в JSX.
 * Так вызов читается линейно, рядом с самим действием.
 */
export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  return {
    confirm,
    dialogProps: {
      open: state !== null,
      title: state?.title ?? "",
      message: state?.message ?? "",
      confirmLabel: state?.confirmLabel,
      cancelLabel: state?.cancelLabel,
      danger: state?.danger,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
